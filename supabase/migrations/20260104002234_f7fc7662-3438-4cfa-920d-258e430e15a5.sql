-- Drop existing constraint
ALTER TABLE public.client_contracts DROP CONSTRAINT IF EXISTS client_contracts_status_check;

-- Add new constraint with updated status values
ALTER TABLE public.client_contracts ADD CONSTRAINT client_contracts_status_check 
CHECK (status IN ('active', 'pending', 'suspended', 'paused', 'cancelled', 'ended', 'scheduled', 'dismissed', 'dropout_7d'));