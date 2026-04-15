
ALTER TABLE public.hr_service_providers
  ADD COLUMN IF NOT EXISTS contract_total_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_down_payment NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_installments_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS contract_installment_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_auto_renewal BOOLEAN DEFAULT false;
