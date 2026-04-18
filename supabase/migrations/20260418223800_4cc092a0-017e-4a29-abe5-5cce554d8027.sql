ALTER TABLE public.sales_incentive_plans
ADD COLUMN IF NOT EXISTS quota_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS goal_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_achievement_percent numeric NOT NULL DEFAULT 40;

COMMENT ON COLUMN public.sales_incentive_plans.quota_value IS 'Valor da quota em R$ — patamar onde o acelerador começa';
COMMENT ON COLUMN public.sales_incentive_plans.goal_value IS 'Valor da meta em R$ — objetivo principal do plano (100%)';
COMMENT ON COLUMN public.sales_incentive_plans.minimum_achievement_percent IS 'Percentual mínimo de atingimento da meta para ganhar comissão (ex: 40)';