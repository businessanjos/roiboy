-- Adicionar campos para suportar mensagens citadas (reply/quote)
ALTER TABLE zapp_messages 
  ADD COLUMN IF NOT EXISTS quoted_message_id TEXT,
  ADD COLUMN IF NOT EXISTS quoted_content TEXT,
  ADD COLUMN IF NOT EXISTS quoted_sender_name TEXT;

-- Comentário para documentação
COMMENT ON COLUMN zapp_messages.quoted_message_id IS 'External message ID da mensagem citada (reply)';
COMMENT ON COLUMN zapp_messages.quoted_content IS 'Conteúdo preview da mensagem citada';
COMMENT ON COLUMN zapp_messages.quoted_sender_name IS 'Nome do remetente da mensagem citada';