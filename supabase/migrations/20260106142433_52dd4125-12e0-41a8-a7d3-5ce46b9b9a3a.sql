-- Add external_id and external_source columns for tracking imported leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS external_source TEXT;

-- Create unique index to prevent duplicate imports from same source
CREATE UNIQUE INDEX IF NOT EXISTS leads_external_unique 
ON leads (account_id, external_source, external_id) 
WHERE external_id IS NOT NULL AND external_source IS NOT NULL;

-- Create index for faster name-based duplicate checks
CREATE INDEX IF NOT EXISTS leads_full_name_lower_idx 
ON leads (account_id, LOWER(full_name));