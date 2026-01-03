-- Add new fields to bank_accounts table based on the reference UI
ALTER TABLE public.bank_accounts 
  ADD COLUMN IF NOT EXISTS initial_balance_date date,
  ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linked_account_id uuid REFERENCES public.bank_accounts(id),
  ADD COLUMN IF NOT EXISTS exclude_from_reports boolean DEFAULT false,
  -- Agency/Branch contact info
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS manager_email text,
  ADD COLUMN IF NOT EXISTS manager_phone text,
  -- Agency address
  ADD COLUMN IF NOT EXISTS agency_street text,
  ADD COLUMN IF NOT EXISTS agency_number text,
  ADD COLUMN IF NOT EXISTS agency_neighborhood text,
  ADD COLUMN IF NOT EXISTS agency_complement text,
  ADD COLUMN IF NOT EXISTS agency_city text,
  ADD COLUMN IF NOT EXISTS agency_state text,
  ADD COLUMN IF NOT EXISTS agency_zip_code text;

-- Add more account types
COMMENT ON COLUMN public.bank_accounts.account_type IS 'Account types: checking, savings, investment, cash, credit_card, payment, loan, guaranteed, application, advance, card_admin, virtual_wallet, installment, mutual';