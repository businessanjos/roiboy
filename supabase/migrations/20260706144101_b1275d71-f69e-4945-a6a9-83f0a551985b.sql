
CREATE TABLE public.lovable_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('recarga','mensalidade')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  occurred_on DATE NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lovable_costs TO authenticated;
GRANT ALL ON public.lovable_costs TO service_role;
ALTER TABLE public.lovable_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account members read lovable_costs" ON public.lovable_costs FOR SELECT TO authenticated
  USING (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()));
CREATE POLICY "account members insert lovable_costs" ON public.lovable_costs FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()));
CREATE POLICY "account members update lovable_costs" ON public.lovable_costs FOR UPDATE TO authenticated
  USING (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()));
CREATE POLICY "account members delete lovable_costs" ON public.lovable_costs FOR DELETE TO authenticated
  USING (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()));
CREATE INDEX idx_lovable_costs_account_date ON public.lovable_costs(account_id, occurred_on DESC);
