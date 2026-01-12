-- Add unique index to prevent duplicate messages from webhook
-- This index only applies when external_message_id is NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_zapp_messages_external_id_unique 
ON zapp_messages(zapp_conversation_id, external_message_id) 
WHERE external_message_id IS NOT NULL;