-- Inserir novos tipos de atividade para todas as contas existentes

-- Onboarding
INSERT INTO activity_types (account_id, name, icon, color, description, is_active, display_order)
SELECT 
  id as account_id,
  'Onboarding',
  'users',
  '#0ea5e9',
  'Processo de onboarding do cliente',
  true,
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM activity_types at2 WHERE at2.account_id = accounts.id)
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM activity_types WHERE name = 'Onboarding' AND activity_types.account_id = accounts.id
);

-- Implementação da Clínica Ryka
INSERT INTO activity_types (account_id, name, icon, color, description, is_active, display_order)
SELECT 
  id as account_id,
  'Implementação da Clínica Ryka',
  'calendar',
  '#8b5cf6',
  'Implementação dos recursos da Clínica Ryka',
  true,
  (SELECT COALESCE(MAX(display_order), 0) + 2 FROM activity_types at2 WHERE at2.account_id = accounts.id)
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM activity_types WHERE name = 'Implementação da Clínica Ryka' AND activity_types.account_id = accounts.id
);

-- Implementação das Ferramentas de IA
INSERT INTO activity_types (account_id, name, icon, color, description, is_active, display_order)
SELECT 
  id as account_id,
  'Implementação das Ferramentas de IA',
  'calendar',
  '#14b8a6',
  'Implementação das ferramentas de inteligência artificial',
  true,
  (SELECT COALESCE(MAX(display_order), 0) + 3 FROM activity_types at2 WHERE at2.account_id = accounts.id)
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM activity_types WHERE name = 'Implementação das Ferramentas de IA' AND activity_types.account_id = accounts.id
);