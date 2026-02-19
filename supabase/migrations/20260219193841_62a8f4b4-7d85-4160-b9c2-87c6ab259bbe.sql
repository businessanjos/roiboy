
-- Table: insights_dashboard_shares
CREATE TABLE public.insights_dashboard_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id uuid NOT NULL REFERENCES public.insights_dashboards(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.users(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insights_dashboard_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage shares from their account"
  ON public.insights_dashboard_shares
  FOR ALL
  USING (account_id = get_my_account_id())
  WITH CHECK (account_id = get_my_account_id());

-- Table: insights_share_access_requests
CREATE TABLE public.insights_share_access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id uuid NOT NULL REFERENCES public.insights_dashboard_shares(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(share_id, email)
);

ALTER TABLE public.insights_share_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage access requests via share account"
  ON public.insights_share_access_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.insights_dashboard_shares s
      WHERE s.id = share_id AND s.account_id = get_my_account_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.insights_dashboard_shares s
      WHERE s.id = share_id AND s.account_id = get_my_account_id()
    )
  );

-- Index for faster token lookups
CREATE INDEX idx_dashboard_shares_token ON public.insights_dashboard_shares(share_token);
CREATE INDEX idx_share_access_requests_share ON public.insights_share_access_requests(share_id);
