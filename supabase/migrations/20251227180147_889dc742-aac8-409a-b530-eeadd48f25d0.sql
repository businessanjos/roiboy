-- Add RG field for PF clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS rg text;

-- Add additional PIX keys as JSON array
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS additional_pix_keys jsonb DEFAULT '[]'::jsonb;

-- Add additional bank accounts as JSON array
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS additional_bank_accounts jsonb DEFAULT '[]'::jsonb;

-- Comments
COMMENT ON COLUMN public.clients.rg IS 'RG (Registro Geral) document number';
COMMENT ON COLUMN public.clients.additional_pix_keys IS 'Array of additional PIX keys with type and key';
COMMENT ON COLUMN public.clients.additional_bank_accounts IS 'Array of additional bank accounts';