
ALTER TABLE public.cs_incentive_plans
  ADD COLUMN IF NOT EXISTS bonus_budget_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_budget_value_type text NOT NULL DEFAULT 'absolute',
  ADD COLUMN IF NOT EXISTS bonus_budget_period text NOT NULL DEFAULT 'quarterly',
  ADD COLUMN IF NOT EXISTS bonus_budget_percent_base text,
  ADD COLUMN IF NOT EXISTS bonus_payment_channel text,
  ADD COLUMN IF NOT EXISTS bonus_payment_when text,
  ADD COLUMN IF NOT EXISTS bonus_distribution_method text NOT NULL DEFAULT 'equal',
  ADD COLUMN IF NOT EXISTS bonus_distribution_shares jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cs_incentive_plans_budget_value_type_chk') THEN
    ALTER TABLE public.cs_incentive_plans
      ADD CONSTRAINT cs_incentive_plans_budget_value_type_chk
      CHECK (bonus_budget_value_type IN ('absolute','percent'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cs_incentive_plans_budget_period_chk') THEN
    ALTER TABLE public.cs_incentive_plans
      ADD CONSTRAINT cs_incentive_plans_budget_period_chk
      CHECK (bonus_budget_period IN ('monthly','quarterly','annual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cs_incentive_plans_distribution_method_chk') THEN
    ALTER TABLE public.cs_incentive_plans
      ADD CONSTRAINT cs_incentive_plans_distribution_method_chk
      CHECK (bonus_distribution_method IN ('equal','by_role','custom'));
  END IF;
END$$;
