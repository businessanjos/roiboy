-- Corrigir assignments com department_id NULL baseado no sector_id da conversa
UPDATE zapp_conversation_assignments ca
SET department_id = (
  SELECT d.id 
  FROM zapp_departments d 
  WHERE d.sector_id = zc.sector_id 
    AND d.account_id = ca.account_id
  ORDER BY d.created_at ASC
  LIMIT 1
)
FROM zapp_conversations zc
WHERE ca.zapp_conversation_id = zc.id
  AND ca.department_id IS NULL
  AND zc.sector_id IS NOT NULL;