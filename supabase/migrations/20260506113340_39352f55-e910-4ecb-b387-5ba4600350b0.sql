
-- Fecha o assignment da conversa vazia (Paula Reis Marinho Costa - duplicata sem 9º dígito)
UPDATE zapp_conversation_assignments
SET status = 'closed', closed_at = now(), close_notes = 'Auto-closed: duplicate empty conversation merged with main one'
WHERE id = '3865a911-f115-4fe4-905e-c0db23201b6e';

-- Remove a conversa vazia para evitar nova confusão
DELETE FROM zapp_conversations
WHERE id = '134bc318-d29a-4131-afc2-7722fae98e1e'
  AND NOT EXISTS (SELECT 1 FROM zapp_messages WHERE zapp_conversation_id = '134bc318-d29a-4131-afc2-7722fae98e1e');
