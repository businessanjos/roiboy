-- Add DRE group classification to financial_categories
ALTER TABLE public.financial_categories 
ADD COLUMN IF NOT EXISTS dre_group text;

-- Add comment explaining the DRE groups
COMMENT ON COLUMN public.financial_categories.dre_group IS 
'DRE classification: gross_revenue, deductions, cogs, admin_expenses, sales_expenses, financial_expenses, other_revenue, other_expenses';