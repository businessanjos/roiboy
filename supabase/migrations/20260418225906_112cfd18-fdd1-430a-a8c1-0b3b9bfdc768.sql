ALTER TABLE public.sales_incentive_plans
  ADD COLUMN IF NOT EXISTS annual_bonus_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS annual_bonus_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quarterly_bonus_rules text,
  ADD COLUMN IF NOT EXISTS annual_bonus_rules text;