
CREATE TABLE public.external_dashboard_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dashboard_id UUID NOT NULL REFERENCES public.insights_dashboards(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, dashboard_id)
);

ALTER TABLE public.external_dashboard_access ENABLE ROW LEVEL SECURITY;

-- Account members can manage external access
CREATE POLICY "Account members can view external access"
  ON public.external_dashboard_access
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Account members can create external access"
  ON public.external_dashboard_access
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Account members can update external access"
  ON public.external_dashboard_access
  FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Account members can delete external access"
  ON public.external_dashboard_access
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- External users can read their own access records
CREATE POLICY "External users can view own access"
  ON public.external_dashboard_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

-- Also allow external users to read the dashboard itself
CREATE POLICY "External users can view assigned dashboards"
  ON public.insights_dashboards
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT dashboard_id FROM public.external_dashboard_access 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Allow external users to read visuals of assigned dashboards
CREATE POLICY "External users can view assigned dashboard visuals"
  ON public.insights_visuals
  FOR SELECT
  TO authenticated
  USING (
    dashboard_id IN (
      SELECT dashboard_id FROM public.external_dashboard_access 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
