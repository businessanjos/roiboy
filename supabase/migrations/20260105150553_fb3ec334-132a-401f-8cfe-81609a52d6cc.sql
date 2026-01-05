-- Drop the existing unique constraint
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_account_id_type_unique;

-- Create a new unique constraint that includes sector_id
-- This allows multiple WhatsApp integrations per account, one per sector
ALTER TABLE integrations ADD CONSTRAINT integrations_account_type_sector_unique 
UNIQUE (account_id, type, sector_id);