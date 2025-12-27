-- Create cost centers table
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6b7280',
  parent_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cost centers from their account"
  ON public.cost_centers FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert cost centers to their account"
  ON public.cost_centers FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update cost centers from their account"
  ON public.cost_centers FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete cost centers from their account"
  ON public.cost_centers FOR DELETE
  USING (account_id = get_user_account_id());

-- Add cost_center_id to financial_entries
ALTER TABLE public.financial_entries 
  ADD COLUMN cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

-- Create budgets table
CREATE TABLE public.financial_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER, -- NULL means annual budget
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  budget_type TEXT NOT NULL DEFAULT 'expense', -- expense or income
  planned_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS
ALTER TABLE public.financial_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budgets from their account"
  ON public.financial_budgets FOR SELECT
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert budgets to their account"
  ON public.financial_budgets FOR INSERT
  WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update budgets from their account"
  ON public.financial_budgets FOR UPDATE
  USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete budgets from their account"
  ON public.financial_budgets FOR DELETE
  USING (account_id = get_user_account_id());

-- Add installment fields to financial_entries
ALTER TABLE public.financial_entries 
  ADD COLUMN installment_number INTEGER,
  ADD COLUMN total_installments INTEGER,
  ADD COLUMN installment_group_id UUID;

-- Function to calculate client profitability
CREATE OR REPLACE FUNCTION public.get_client_profitability(p_account_id uuid, p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  total_revenue numeric,
  total_costs numeric,
  profit numeric,
  margin numeric,
  entries_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id as client_id,
    c.full_name as client_name,
    COALESCE(SUM(CASE WHEN fe.entry_type = 'receivable' AND fe.status = 'paid' THEN fe.amount ELSE 0 END), 0) as total_revenue,
    COALESCE(SUM(CASE WHEN fe.entry_type = 'payable' AND fe.status = 'paid' THEN fe.amount ELSE 0 END), 0) as total_costs,
    COALESCE(SUM(CASE WHEN fe.entry_type = 'receivable' AND fe.status = 'paid' THEN fe.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN fe.entry_type = 'payable' AND fe.status = 'paid' THEN fe.amount ELSE 0 END), 0) as profit,
    CASE 
      WHEN COALESCE(SUM(CASE WHEN fe.entry_type = 'receivable' AND fe.status = 'paid' THEN fe.amount ELSE 0 END), 0) > 0 
      THEN (
        (COALESCE(SUM(CASE WHEN fe.entry_type = 'receivable' AND fe.status = 'paid' THEN fe.amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN fe.entry_type = 'payable' AND fe.status = 'paid' THEN fe.amount ELSE 0 END), 0)) /
        COALESCE(SUM(CASE WHEN fe.entry_type = 'receivable' AND fe.status = 'paid' THEN fe.amount ELSE 0 END), 0)
      ) * 100
      ELSE 0
    END as margin,
    COUNT(fe.id)::integer as entries_count
  FROM public.clients c
  LEFT JOIN public.financial_entries fe ON fe.client_id = c.id
    AND (p_start_date IS NULL OR fe.payment_date >= p_start_date)
    AND (p_end_date IS NULL OR fe.payment_date <= p_end_date)
  WHERE c.account_id = p_account_id
  GROUP BY c.id, c.full_name
  HAVING COUNT(fe.id) > 0
  ORDER BY profit DESC;
$$;

-- Function to get budget vs actual
CREATE OR REPLACE FUNCTION public.get_budget_vs_actual(p_account_id uuid, p_year integer, p_month integer DEFAULT NULL)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  cost_center_id uuid,
  cost_center_name text,
  budget_type text,
  planned_amount numeric,
  actual_amount numeric,
  variance numeric,
  variance_percent numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    fb.category_id,
    fc.name as category_name,
    fb.cost_center_id,
    cc.name as cost_center_name,
    fb.budget_type,
    fb.planned_amount,
    COALESCE(SUM(fe.amount), 0) as actual_amount,
    fb.planned_amount - COALESCE(SUM(fe.amount), 0) as variance,
    CASE 
      WHEN fb.planned_amount > 0 
      THEN ((fb.planned_amount - COALESCE(SUM(fe.amount), 0)) / fb.planned_amount) * 100
      ELSE 0
    END as variance_percent
  FROM public.financial_budgets fb
  LEFT JOIN public.financial_categories fc ON fc.id = fb.category_id
  LEFT JOIN public.cost_centers cc ON cc.id = fb.cost_center_id
  LEFT JOIN public.financial_entries fe ON fe.account_id = fb.account_id
    AND fe.status = 'paid'
    AND (fb.category_id IS NULL OR fe.category_id = fb.category_id)
    AND (fb.cost_center_id IS NULL OR fe.cost_center_id = fb.cost_center_id)
    AND EXTRACT(YEAR FROM fe.payment_date) = fb.year
    AND (fb.month IS NULL OR EXTRACT(MONTH FROM fe.payment_date) = fb.month)
    AND (
      (fb.budget_type = 'expense' AND fe.entry_type = 'payable') OR
      (fb.budget_type = 'income' AND fe.entry_type = 'receivable')
    )
  WHERE fb.account_id = p_account_id
    AND fb.year = p_year
    AND (p_month IS NULL OR fb.month IS NULL OR fb.month = p_month)
  GROUP BY fb.id, fb.category_id, fc.name, fb.cost_center_id, cc.name, fb.budget_type, fb.planned_amount;
$$;