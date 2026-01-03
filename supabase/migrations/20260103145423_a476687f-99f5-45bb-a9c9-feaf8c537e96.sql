-- Add missing columns to financial_entries table for complete field mapping
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS issue_date date;
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS registration_date date;
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS payment_forecast_date date;
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS expected_date date;
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.users(id);
ALTER TABLE public.financial_entries ADD COLUMN IF NOT EXISTS project_id uuid;

-- Add indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_financial_entries_seller_id ON public.financial_entries(seller_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_issue_date ON public.financial_entries(issue_date);
CREATE INDEX IF NOT EXISTS idx_financial_entries_expected_date ON public.financial_entries(expected_date);