-- Add sector_id column to zapp_departments to link with system sectors
ALTER TABLE public.zapp_departments 
ADD COLUMN sector_id text;

-- Add comment explaining the column
COMMENT ON COLUMN public.zapp_departments.sector_id IS 'Links to system sector: operacoes, financeiro, royzapp, vendas, marketing, configuracoes';

-- Create index for sector lookups
CREATE INDEX idx_zapp_departments_sector_id ON public.zapp_departments(sector_id);