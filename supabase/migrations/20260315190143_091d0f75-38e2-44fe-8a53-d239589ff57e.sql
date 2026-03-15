
-- Add monthly quota to commission_plans (same for all sellers)
ALTER TABLE public.commission_plans ADD COLUMN IF NOT EXISTS monthly_quota NUMERIC NOT NULL DEFAULT 450000;

-- Add fixed_salary and team_bonus_percent to sales levels
ALTER TABLE public.commission_sales_levels ADD COLUMN IF NOT EXISTS fixed_salary NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.commission_sales_levels ADD COLUMN IF NOT EXISTS team_bonus_percent NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.commission_sales_levels ADD COLUMN IF NOT EXISTS total_compensation NUMERIC NOT NULL DEFAULT 0;

-- Add prospecting commission rate to plans
ALTER TABLE public.commission_plans ADD COLUMN IF NOT EXISTS prospecting_commission_percent NUMERIC NOT NULL DEFAULT 3;
