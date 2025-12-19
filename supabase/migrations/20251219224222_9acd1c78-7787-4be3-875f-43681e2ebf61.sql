-- Add more complete fields to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'cpf', -- 'cpf' or 'cnpj'
ADD COLUMN IF NOT EXISTS document text, -- CPF or CNPJ number
ADD COLUMN IF NOT EXISTS contact_name text, -- Contact person name (for companies)
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS street_number text,
ADD COLUMN IF NOT EXISTS complement text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip_code text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Add comment for clarity
COMMENT ON COLUMN public.accounts.document_type IS 'Type of document: cpf for individuals, cnpj for companies';
COMMENT ON COLUMN public.accounts.contact_name IS 'Contact person name, especially useful for company accounts';