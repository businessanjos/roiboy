-- LIMPEZA DE DUPLICATAS: Remover integrações WhatsApp duplicadas
-- Mantém apenas a mais recente por account_id e instance_name

-- 1. Primeiro, identificar e deletar duplicatas
WITH duplicates AS (
  SELECT 
    id,
    account_id,
    sector_id,
    config->>'instance_name' as instance_name,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, config->>'instance_name'
      ORDER BY created_at DESC
    ) as rn
  FROM integrations
  WHERE type = 'whatsapp'
    AND config->>'instance_name' IS NOT NULL
)
DELETE FROM integrations
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Criar índice único para PREVENIR duplicatas futuras
-- Uma instância WhatsApp só pode existir UMA VEZ por account
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_unique_whatsapp_instance_per_account 
ON integrations (account_id, (config->>'instance_name'))
WHERE type = 'whatsapp' AND config->>'instance_name' IS NOT NULL;