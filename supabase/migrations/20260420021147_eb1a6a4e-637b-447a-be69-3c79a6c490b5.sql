ALTER TABLE public.sales_incentive_plans
ADD COLUMN IF NOT EXISTS uncapped_bonus_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS uncapped_threshold_percent numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS uncapped_bonus_per_sale numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS uncapped_bonus_type text NOT NULL DEFAULT 'fixed';