-- Add status and status_reason columns to client_contracts
ALTER TABLE public.client_contracts 
ADD COLUMN status text NOT NULL DEFAULT 'active',
ADD COLUMN status_reason text NULL,
ADD COLUMN status_changed_at timestamp with time zone NULL;

-- Add check constraint for valid status values
ALTER TABLE public.client_contracts
ADD CONSTRAINT client_contracts_status_check 
CHECK (status IN ('active', 'cancelled', 'ended', 'paused'));