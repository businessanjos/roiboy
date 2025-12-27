-- Add banking and PIX fields to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS pix_key_type text,
ADD COLUMN IF NOT EXISTS pix_key text,
ADD COLUMN IF NOT EXISTS bank_code text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_agency text,
ADD COLUMN IF NOT EXISTS bank_account text,
ADD COLUMN IF NOT EXISTS bank_account_type text DEFAULT 'checking';

-- Add comment for documentation
COMMENT ON COLUMN public.clients.pix_key_type IS 'Type of PIX key: cpf, cnpj, email, phone, random';
COMMENT ON COLUMN public.clients.pix_key IS 'PIX key value';
COMMENT ON COLUMN public.clients.bank_account_type IS 'Account type: checking or savings';