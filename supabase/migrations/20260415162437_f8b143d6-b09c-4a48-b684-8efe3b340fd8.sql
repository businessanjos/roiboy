
ALTER TABLE public.hr_partners
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS pis_pasep text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_pix_key text,
  ADD COLUMN IF NOT EXISTS marital_property_regime text,
  ADD COLUMN IF NOT EXISTS holding_cnpj text,
  ADD COLUMN IF NOT EXISTS partner_type text DEFAULT 'quotista',
  ADD COLUMN IF NOT EXISTS social_contract_number text;
