ALTER TABLE public.hr_service_providers
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_agency TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS bank_pix_key TEXT,
  ADD COLUMN IF NOT EXISTS contract_number TEXT;