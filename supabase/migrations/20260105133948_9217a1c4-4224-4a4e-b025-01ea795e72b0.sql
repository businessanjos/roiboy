-- Add source_contract_id to deals table for traceability
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS source_contract_id UUID REFERENCES public.client_contracts(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deals_source_contract_id ON public.deals(source_contract_id);

-- Add comment for documentation
COMMENT ON COLUMN public.deals.source_contract_id IS 'Reference to the original contract for renewal deals';