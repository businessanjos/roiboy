-- Drop the existing check constraint and recreate with suspended status
ALTER TABLE public.client_contracts 
DROP CONSTRAINT IF EXISTS client_contracts_status_check;

ALTER TABLE public.client_contracts
ADD CONSTRAINT client_contracts_status_check 
CHECK (status IN ('active', 'pending', 'cancelled', 'ended', 'paused', 'suspended'));