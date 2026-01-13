-- Inserir atividades retroativas para negócios GANHOS
INSERT INTO deal_activities (account_id, deal_id, type, title, old_value, new_value, created_at)
SELECT 
  account_id,
  id as deal_id,
  'status_change' as type,
  'Negócio ganho' as title,
  'Em aberto' as old_value,
  'Ganho' as new_value,
  won_at as created_at
FROM deals 
WHERE status = 'won' 
  AND won_at IS NOT NULL
  AND id NOT IN (
    SELECT deal_id FROM deal_activities 
    WHERE type = 'status_change' AND new_value = 'Ganho'
  );

-- Inserir atividades retroativas para negócios PERDIDOS
INSERT INTO deal_activities (account_id, deal_id, type, title, old_value, new_value, created_at)
SELECT 
  account_id,
  id as deal_id,
  'status_change' as type,
  'Negócio perdido' as title,
  'Em aberto' as old_value,
  'Perdido' as new_value,
  lost_at as created_at
FROM deals 
WHERE status = 'lost' 
  AND lost_at IS NOT NULL
  AND id NOT IN (
    SELECT deal_id FROM deal_activities 
    WHERE type = 'status_change' AND new_value = 'Perdido'
  );