-- Add business address columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS business_street TEXT,
ADD COLUMN IF NOT EXISTS business_street_number TEXT,
ADD COLUMN IF NOT EXISTS business_complement TEXT,
ADD COLUMN IF NOT EXISTS business_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS business_city TEXT,
ADD COLUMN IF NOT EXISTS business_state TEXT,
ADD COLUMN IF NOT EXISTS business_zip_code TEXT;

-- Add comment to clarify the address fields
COMMENT ON COLUMN public.clients.street IS 'Residential address - street';
COMMENT ON COLUMN public.clients.business_street IS 'Business address - street (auto-filled from CNPJ)';