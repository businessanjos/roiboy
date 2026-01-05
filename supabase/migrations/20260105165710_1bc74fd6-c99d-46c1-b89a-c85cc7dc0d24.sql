-- Índices compostos para performance multi-tenant
-- Otimiza queries frequentes que filtram por account_id + department_id/sector_id

CREATE INDEX IF NOT EXISTS idx_zapp_conv_assign_account_dept 
  ON zapp_conversation_assignments(account_id, department_id);

CREATE INDEX IF NOT EXISTS idx_zapp_conversations_account 
  ON zapp_conversations(account_id);

CREATE INDEX IF NOT EXISTS idx_integrations_account_sector 
  ON integrations(account_id, sector_id) WHERE type = 'whatsapp';

CREATE INDEX IF NOT EXISTS idx_zapp_messages_account 
  ON zapp_messages(account_id);

CREATE INDEX IF NOT EXISTS idx_zapp_departments_account_sector 
  ON zapp_departments(account_id, sector_id);