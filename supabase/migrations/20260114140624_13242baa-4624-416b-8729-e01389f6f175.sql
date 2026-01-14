-- Migração: Preencher integration_id em conversas existentes
-- Isso vincula cada conversa à instância WhatsApp correta baseado no sector_id

-- Primeiro, atualizar conversas onde há apenas UMA instância conectada por setor
UPDATE zapp_conversations c
SET integration_id = (
  SELECT i.id 
  FROM integrations i 
  WHERE i.sector_id = c.sector_id 
    AND i.account_id = c.account_id 
    AND i.type = 'whatsapp' 
    AND i.status = 'connected'
  LIMIT 1
)
WHERE c.integration_id IS NULL
  AND EXISTS (
    SELECT 1 FROM integrations i 
    WHERE i.sector_id = c.sector_id 
      AND i.account_id = c.account_id 
      AND i.type = 'whatsapp' 
      AND i.status = 'connected'
  );

-- Adicionar índice para melhorar performance de queries filtradas por integration_id
CREATE INDEX IF NOT EXISTS idx_zapp_conversations_integration_id 
ON zapp_conversations(integration_id);

-- Adicionar índice composto para queries frequentes
CREATE INDEX IF NOT EXISTS idx_zapp_conversations_account_sector_integration 
ON zapp_conversations(account_id, sector_id, integration_id);