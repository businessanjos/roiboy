CREATE TABLE public.insights_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Meta',
  entity text NOT NULL DEFAULT 'deal' CHECK (entity IN ('deal','activity','forecast')),
  metric text NOT NULL DEFAULT 'won_revenue' CHECK (metric IN ('won_revenue','deal_count','activities_completed','forecast_revenue')),
  scope_type text NOT NULL DEFAULT 'company' CHECK (scope_type IN ('company','user','pipeline','product')),
  scope_id uuid,
  pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  activity_type_id uuid REFERENCES public.activity_types(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights_goals TO authenticated;
GRANT ALL ON public.insights_goals TO service_role;

ALTER TABLE public.insights_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insights_goals in their account"
  ON public.insights_goals FOR SELECT TO authenticated
  USING (account_id = get_user_account_id() OR is_super_admin());

CREATE POLICY "Users can insert insights_goals in their account"
  ON public.insights_goals FOR INSERT TO authenticated
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update insights_goals in their account"
  ON public.insights_goals FOR UPDATE TO authenticated
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete insights_goals in their account"
  ON public.insights_goals FOR DELETE TO authenticated
  USING (account_id = get_user_account_id());

CREATE INDEX idx_insights_goals_account ON public.insights_goals(account_id);
CREATE INDEX idx_insights_goals_period ON public.insights_goals(account_id, period_start, period_end);

CREATE TRIGGER update_insights_goals_updated_at
  BEFORE UPDATE ON public.insights_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migração das metas mensais de vendedor existentes
INSERT INTO public.insights_goals (account_id, name, entity, metric, scope_type, scope_id, frequency, period_start, period_end, target_value, notes)
SELECT
  g.account_id,
  'Meta mensal ' || g.year_month,
  'deal',
  'won_revenue',
  CASE WHEN g.user_id IS NULL THEN 'company' ELSE 'user' END,
  g.user_id,
  'monthly',
  to_date(g.year_month || '-01', 'YYYY-MM-DD'),
  (to_date(g.year_month || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date,
  COALESCE(g.goal_value, 0),
  g.notes
FROM public.sales_monthly_goals g
WHERE g.year_month ~ '^\d{4}-\d{2}$';

-- Migração da meta anual da empresa
INSERT INTO public.insights_goals (account_id, name, entity, metric, scope_type, frequency, period_start, period_end, target_value, notes)
SELECT
  c.account_id,
  'Meta anual ' || c.year,
  'deal',
  'won_revenue',
  'company',
  'yearly',
  make_date(c.year, 1, 1),
  make_date(c.year, 12, 31),
  COALESCE(c.annual_goal, 0),
  c.notes
FROM public.company_goals c;