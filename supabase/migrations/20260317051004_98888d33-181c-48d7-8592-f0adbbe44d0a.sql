
CREATE TABLE public.sales_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  meeting_url TEXT,
  meeting_type TEXT DEFAULT 'scheduled',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view meetings in their account"
  ON public.sales_meetings FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert meetings in their account"
  ON public.sales_meetings FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update meetings in their account"
  ON public.sales_meetings FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete meetings in their account"
  ON public.sales_meetings FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
