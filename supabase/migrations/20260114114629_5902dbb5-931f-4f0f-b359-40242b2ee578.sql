-- Remove the unique constraint that prevents multiple instances per sector
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_account_type_sector_unique;

-- Drop the unique index if it exists
DROP INDEX IF EXISTS idx_integrations_account_type_sector;

-- Add column for PIN hash per instance (allows individual PIN protection)
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS pin_hash TEXT DEFAULT NULL;

-- Add column for friendly display name
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT NULL;