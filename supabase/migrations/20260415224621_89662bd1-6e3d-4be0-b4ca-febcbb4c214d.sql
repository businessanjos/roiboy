
-- Expand sales_incentive_plans with OTE, clawback, quarterly bonus
ALTER TABLE public.sales_incentive_plans 
  ADD COLUMN IF NOT EXISTS clawback_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clawback_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS clawback_percent numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS quarterly_bonus_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quarterly_bonus_value numeric NOT NULL DEFAULT 0;

-- Individual OTE per user per year
CREATE TABLE IF NOT EXISTS public.sales_user_ote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  year integer NOT NULL,
  base_salary_annual numeric NOT NULL DEFAULT 0,
  variable_target_annual numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id, year)
);

ALTER TABLE public.sales_user_ote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view OTE in their account" ON public.sales_user_ote
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage OTE in their account" ON public.sales_user_ote
  FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- SPIFFs table for temporary incentive campaigns
CREATE TABLE IF NOT EXISTS public.sales_spiffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.sales_incentive_plans(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  bonus_amount numeric NOT NULL DEFAULT 0,
  bonus_type text NOT NULL DEFAULT 'fixed',
  target_quantity integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_spiffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SPIFFs in their account" ON public.sales_spiffs
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage SPIFFs in their account" ON public.sales_spiffs
  FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
