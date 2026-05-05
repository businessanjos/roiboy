-- CS Incentive Plans (mirrors sales_incentive_plans, adapted to Customer Success)
CREATE TABLE IF NOT EXISTS public.cs_incentive_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  user_id UUID NULL, -- consultora; NULL = plano-modelo do time
  name TEXT NOT NULL DEFAULT 'Plano CS',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Remuneração base (informativo)
  base_salary_monthly NUMERIC NOT NULL DEFAULT 0,
  variable_target_monthly NUMERIC NOT NULL DEFAULT 0,
  -- Mínimo de atingimento global para liberar bônus
  minimum_achievement_percent NUMERIC NOT NULL DEFAULT 70,
  -- Pesos das métricas estrela (somam 100)
  weight_renewal NUMERIC NOT NULL DEFAULT 50,
  weight_churn NUMERIC NOT NULL DEFAULT 30,
  weight_nps NUMERIC NOT NULL DEFAULT 20,
  -- Bônus mensal base (gatilho ao bater meta global)
  monthly_bonus_value NUMERIC NOT NULL DEFAULT 0,
  monthly_bonus_payment_channel TEXT DEFAULT 'folha',
  -- Bônus trimestral
  quarterly_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  quarterly_bonus_value NUMERIC NOT NULL DEFAULT 0,
  quarterly_bonus_rules TEXT,
  quarterly_bonus_payment_channel TEXT DEFAULT 'ferias_co',
  -- Bônus anual
  annual_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  annual_bonus_value NUMERIC NOT NULL DEFAULT 0,
  annual_bonus_rules TEXT,
  annual_bonus_payment_channel TEXT DEFAULT 'ferias_co',
  -- Penalidade por churn alto (clawback simbólico de CS)
  churn_penalty_enabled BOOLEAN NOT NULL DEFAULT false,
  churn_penalty_threshold NUMERIC NOT NULL DEFAULT 10,
  churn_penalty_percent NUMERIC NOT NULL DEFAULT 50,
  -- Rotinas / rituais de CS (checklist livre)
  routines JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cs_incentive_plans_unique_active_per_user
  ON public.cs_incentive_plans (account_id, COALESCE(user_id::text, 'team'))
  WHERE is_active = true;

ALTER TABLE public.cs_incentive_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_incentive_plans_select"
  ON public.cs_incentive_plans FOR SELECT
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "cs_incentive_plans_insert"
  ON public.cs_incentive_plans FOR INSERT
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "cs_incentive_plans_update"
  ON public.cs_incentive_plans FOR UPDATE
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "cs_incentive_plans_delete"
  ON public.cs_incentive_plans FOR DELETE
  USING (account_id = public.get_current_user_account_id());

CREATE TRIGGER trg_cs_incentive_plans_updated
  BEFORE UPDATE ON public.cs_incentive_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Faixas (tiers) por atingimento global
CREATE TABLE IF NOT EXISTS public.cs_incentive_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.cs_incentive_plans(id) ON DELETE CASCADE,
  min_achievement_percent NUMERIC NOT NULL,
  max_achievement_percent NUMERIC,
  bonus_multiplier NUMERIC NOT NULL DEFAULT 1,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cs_incentive_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_incentive_tiers_select"
  ON public.cs_incentive_tiers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.cs_incentive_plans p WHERE p.id = plan_id AND p.account_id = public.get_current_user_account_id()));
CREATE POLICY "cs_incentive_tiers_modify"
  ON public.cs_incentive_tiers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.cs_incentive_plans p WHERE p.id = plan_id AND p.account_id = public.get_current_user_account_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cs_incentive_plans p WHERE p.id = plan_id AND p.account_id = public.get_current_user_account_id()));
