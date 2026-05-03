CREATE TABLE public.vip_criteria (
  account_id UUID NOT NULL PRIMARY KEY,
  min_received NUMERIC NOT NULL DEFAULT 150000,
  min_ltv_months INTEGER NOT NULL DEFAULT 0,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  top_n INTEGER NOT NULL DEFAULT 30,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vip_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vip_criteria of their account"
ON public.vip_criteria FOR SELECT TO authenticated
USING (user_belongs_to_account(account_id));

CREATE POLICY "Users can insert vip_criteria for their account"
ON public.vip_criteria FOR INSERT TO authenticated
WITH CHECK (user_belongs_to_account(account_id));

CREATE POLICY "Users can update vip_criteria of their account"
ON public.vip_criteria FOR UPDATE TO authenticated
USING (user_belongs_to_account(account_id))
WITH CHECK (user_belongs_to_account(account_id));

CREATE TRIGGER update_vip_criteria_updated_at
BEFORE UPDATE ON public.vip_criteria
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();