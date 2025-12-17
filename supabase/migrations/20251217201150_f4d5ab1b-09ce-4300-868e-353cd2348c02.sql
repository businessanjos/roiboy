-- Add MLS fields to clients table
ALTER TABLE public.clients 
ADD COLUMN is_mls boolean NOT NULL DEFAULT false,
ADD COLUMN mls_level text;

-- Add check constraint for valid MLS levels
ALTER TABLE public.clients 
ADD CONSTRAINT clients_mls_level_check 
CHECK (mls_level IS NULL OR mls_level IN ('bronze', 'prata', 'ouro', 'diamond', 'platinum'));