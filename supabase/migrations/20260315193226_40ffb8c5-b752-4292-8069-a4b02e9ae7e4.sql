
-- Store custom goal metrics per cargo per account
CREATE TABLE public.sales_goal_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  cargo text NOT NULL,
  metric_key text NOT NULL,
  metric_label text NOT NULL,
  metric_unit text NOT NULL DEFAULT '',
  default_value numeric NOT NULL DEFAULT 0,
  is_currency boolean NOT NULL DEFAULT false,
  icon_name text NOT NULL DEFAULT 'target',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, cargo, metric_key)
);

ALTER TABLE public.sales_goal_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account metrics"
  ON public.sales_goal_metrics FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage own account metrics"
  ON public.sales_goal_metrics FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
