-- Adicionar coluna sector_id na tabela forms para associar formulários a setores
ALTER TABLE public.forms 
ADD COLUMN sector_id text;

-- Criar índice para busca por setor
CREATE INDEX idx_forms_sector_id ON public.forms(sector_id);

-- Comentário explicativo
COMMENT ON COLUMN public.forms.sector_id IS 
  'Setor proprietário do formulário: operacoes, vendas, financeiro, marketing, royzapp, roychat, configuracoes, diretoria';

-- Atualizar formulários existentes para o setor de operações (baseado nos nomes típicos)
UPDATE public.forms 
SET sector_id = 'operacoes' 
WHERE sector_id IS NULL;