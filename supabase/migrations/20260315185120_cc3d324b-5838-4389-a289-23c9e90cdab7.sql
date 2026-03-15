
-- Sales levels table: defines levels (Junior, Pleno, Senior) with monthly targets
CREATE TABLE public.commission_sales_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.commission_plans(id) ON DELETE CASCADE,
  level_name TEXT NOT NULL,
  monthly_target NUMERIC NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add tier_mode column to commission_plans (percent_of_target or absolute)
ALTER TABLE public.commission_plans ADD COLUMN IF NOT EXISTS tier_mode TEXT NOT NULL DEFAULT 'percent_of_target';

-- Update period_type default to monthly
ALTER TABLE public.commission_plans ALTER COLUMN period_type SET DEFAULT 'monthly';

-- Enable RLS
ALTER TABLE public.commission_sales_levels ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view sales levels of their account"
  ON public.commission_sales_levels FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage sales levels of their account"
  ON public.commission_sales_levels FOR ALL
  TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
