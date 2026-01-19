-- Adicionar coluna sector_id na tabela activity_types
ALTER TABLE activity_types 
ADD COLUMN sector_id TEXT DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN activity_types.sector_id IS 
  'Setor ao qual este tipo pertence (operacoes, vendas, marketing, etc). NULL = visível em todos os setores';

-- Atualizar tipos de Operações para a conta principal
UPDATE activity_types 
SET sector_id = 'operacoes' 
WHERE account_id = '796e7970-fd93-4574-a871-6090624cace6'
AND name IN ('Onboarding', 'Implementação da Clínica Ryka', 'Implementação das Ferramentas de IA');

-- Atualizar tipos de Vendas para a conta principal
UPDATE activity_types 
SET sector_id = 'vendas' 
WHERE account_id = '796e7970-fd93-4574-a871-6090624cace6'
AND name IN (
  'Call Comercial Agendada', 
  'Call Comercial Concluída', 
  'Ligação Atendida', 
  'Ligação não atendida',
  'Follow Up',
  'No-Show',
  'Primeiro Contato Realizado',
  'Proposta de Fechamento'
);