
-- Tabela de metas de bonificação para consultoras (operações)
CREATE TABLE IF NOT EXISTS public.consultant_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  year integer NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('renewal_rate', 'churn_rate', 'nps')),
  annual_target numeric NOT NULL DEFAULT 0,
  monthly_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  bonus_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id, product_id, year, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_consultant_goals_user_year
  ON public.consultant_goals (user_id, year);
CREATE INDEX IF NOT EXISTS idx_consultant_goals_account_year
  ON public.consultant_goals (account_id, year);

ALTER TABLE public.consultant_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view consultant_goals in their account"
  ON public.consultant_goals FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage consultant_goals in their account"
  ON public.consultant_goals FOR ALL
  TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE TRIGGER update_consultant_goals_updated_at
  BEFORE UPDATE ON public.consultant_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
