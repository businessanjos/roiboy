-- Add contract_type column to client_contracts
ALTER TABLE public.client_contracts 
ADD COLUMN contract_type text NOT NULL DEFAULT 'compra';

-- Add comment for documentation
COMMENT ON COLUMN public.client_contracts.contract_type IS 'Type of contract: compra, confissao_divida, termo_congelamento, distrato';