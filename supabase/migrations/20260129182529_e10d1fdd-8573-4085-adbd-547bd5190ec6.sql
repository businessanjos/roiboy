-- Add deal_id column to client_contracts to link contracts to deals
ALTER TABLE public.client_contracts 
ADD COLUMN deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_client_contracts_deal_id ON public.client_contracts(deal_id);