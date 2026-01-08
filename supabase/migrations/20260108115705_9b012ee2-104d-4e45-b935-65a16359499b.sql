-- Adicionar coluna is_deleted à tabela zapp_messages
ALTER TABLE zapp_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Adicionar coluna deleted_at para auditoria
ALTER TABLE zapp_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índice para performance em queries que filtram mensagens deletadas
CREATE INDEX IF NOT EXISTS idx_zapp_messages_is_deleted ON zapp_messages(zapp_conversation_id, is_deleted);

-- Habilitar realtime para UPDATE na tabela (caso ainda não esteja)
ALTER TABLE zapp_messages REPLICA IDENTITY FULL;