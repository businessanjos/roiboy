
-- Table to store each sales rep's career assignment (contract type + career level)
CREATE TABLE public.sales_team_careers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contract_type text NOT NULL DEFAULT 'CLT' CHECK (contract_type IN ('CLT', 'PJ')),
  career_level_name text NOT NULL DEFAULT 'Anjo Vendedor',
  fixed_salary numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);

ALTER TABLE public.sales_team_careers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account careers"
  ON public.sales_team_careers FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage own account careers"
  ON public.sales_team_careers FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

-- Table to store monthly sales goals per user
CREATE TABLE public.sales_monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year_month text NOT NULL, -- format: "2026-03"
  goal_value numeric NOT NULL DEFAULT 450000,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id, year_month)
);

ALTER TABLE public.sales_monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account goals"
  ON public.sales_monthly_goals FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage own account goals"
  ON public.sales_monthly_goals FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
