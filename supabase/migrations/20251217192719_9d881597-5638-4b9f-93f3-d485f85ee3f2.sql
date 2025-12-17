-- Add parent_contract_id to track renewals
ALTER TABLE public.client_contracts 
ADD COLUMN parent_contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_client_contracts_parent ON public.client_contracts(parent_contract_id);