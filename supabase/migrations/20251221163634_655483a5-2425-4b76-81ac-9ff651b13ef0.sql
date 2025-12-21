-- Add product_id column to client_contracts table
ALTER TABLE public.client_contracts
ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_client_contracts_product_id ON public.client_contracts(product_id);