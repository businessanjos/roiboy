-- CORREÇÃO CRÍTICA: Deletar assignments duplicados incorretos em duas etapas

-- Etapa 1: Deletar assignments com department_id incorreto onde já existe um correto
DELETE FROM zapp_conversation_assignments 
WHERE id IN (
  SELECT zca.id 
  FROM zapp_conversation_assignments zca
  INNER JOIN zapp_conversations zc ON zc.id = zca.zapp_conversation_id
  INNER JOIN zapp_departments d ON d.id = zca.department_id
  WHERE d.sector_id IS DISTINCT FROM zc.sector_id
    AND zc.sector_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM zapp_conversation_assignments zca2
      INNER JOIN zapp_departments d2 ON d2.id = zca2.department_id
      WHERE zca2.zapp_conversation_id = zca.zapp_conversation_id
        AND d2.sector_id = zc.sector_id
    )
);

-- Etapa 2: Corrigir os assignments restantes
UPDATE zapp_conversation_assignments AS target
SET department_id = correct_dept.id
FROM zapp_conversation_assignments AS source
INNER JOIN zapp_conversations zc ON zc.id = source.zapp_conversation_id
INNER JOIN zapp_departments wrong_dept ON wrong_dept.id = source.department_id
CROSS JOIN LATERAL (
  SELECT d.id 
  FROM zapp_departments d 
  WHERE d.sector_id = zc.sector_id 
    AND d.account_id = source.account_id
  LIMIT 1
) AS correct_dept
WHERE target.id = source.id
  AND wrong_dept.sector_id IS DISTINCT FROM zc.sector_id
  AND zc.sector_id IS NOT NULL;