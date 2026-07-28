
CREATE TABLE public.sales_rep_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly','monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('revenue','count')),
  target_value NUMERIC NOT NULL CHECK (target_value >= 0),
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sales_rep_goals_account_user_idx ON public.sales_rep_goals(account_id, user_id);
CREATE INDEX sales_rep_goals_period_idx ON public.sales_rep_goals(period_start, period_end);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_rep_goals TO authenticated;
GRANT ALL ON public.sales_rep_goals TO service_role;

ALTER TABLE public.sales_rep_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_rep_goals_select_same_account"
ON public.sales_rep_goals FOR SELECT TO authenticated
USING (account_id = public.get_current_user_account_id());

CREATE POLICY "sales_rep_goals_insert_same_account"
ON public.sales_rep_goals FOR INSERT TO authenticated
WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "sales_rep_goals_update_same_account"
ON public.sales_rep_goals FOR UPDATE TO authenticated
USING (account_id = public.get_current_user_account_id())
WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "sales_rep_goals_delete_same_account"
ON public.sales_rep_goals FOR DELETE TO authenticated
USING (account_id = public.get_current_user_account_id());

CREATE TRIGGER update_sales_rep_goals_updated_at
BEFORE UPDATE ON public.sales_rep_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
