-- Add sector_id column to integrations table to allow one WhatsApp connection per sector
ALTER TABLE public.integrations 
ADD COLUMN sector_id TEXT DEFAULT NULL;

-- Create unique constraint to ensure one integration per type per sector per account
-- Allow NULL sector_id for backward compatibility (existing integrations without sector)
CREATE UNIQUE INDEX idx_integrations_account_type_sector 
ON public.integrations (account_id, type, sector_id)
WHERE sector_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.integrations.sector_id IS 'Setor associado à integração (operacoes, financeiro, vendas, royzapp)';