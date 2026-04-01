-- Add Clinica Ryka sync tracking columns to client_contracts
ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS clinica_ryka_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clinica_ryka_synced_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clinica_ryka_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clinica_ryka_external_id text DEFAULT NULL;

-- Add index for quick lookup of pending syncs
CREATE INDEX IF NOT EXISTS idx_client_contracts_clinica_ryka_status 
  ON public.client_contracts (clinica_ryka_status) 
  WHERE clinica_ryka_status IS NOT NULL;