-- Add enriched fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS emails jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS additional_phones jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS street_number text,
ADD COLUMN IF NOT EXISTS complement text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip_code text;

-- Create indexes for CPF and CNPJ for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON public.clients(cnpj) WHERE cnpj IS NOT NULL;

-- Add unique constraints to prevent duplicate CPF/CNPJ within an account
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cpf_account ON public.clients(account_id, cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cnpj_account ON public.clients(account_id, cnpj) WHERE cnpj IS NOT NULL;