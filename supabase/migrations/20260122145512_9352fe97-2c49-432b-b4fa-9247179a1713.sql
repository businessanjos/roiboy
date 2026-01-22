-- Add "Apresentação do Plano de Ação" activity type for all accounts in Operações sector
INSERT INTO activity_types (
  account_id, 
  name, 
  icon, 
  color, 
  description, 
  is_active, 
  display_order, 
  sector_id
)
SELECT 
  id as account_id,
  'Apresentação do Plano de Ação',
  'presentation',
  '#10b981',
  'Apresentação do plano de ação para o cliente',
  true,
  (SELECT COALESCE(MAX(display_order), 0) + 1 
   FROM activity_types at2 
   WHERE at2.account_id = accounts.id),
  'operacoes'
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM activity_types 
  WHERE name = 'Apresentação do Plano de Ação' 
  AND activity_types.account_id = accounts.id
);