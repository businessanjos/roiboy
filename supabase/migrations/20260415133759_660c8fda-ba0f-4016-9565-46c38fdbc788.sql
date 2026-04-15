UPDATE zapp_messages 
SET delivery_status = 'sent' 
WHERE message_type = 'audio' 
AND direction = 'outbound' 
AND delivery_status = 'failed' 
AND external_message_id IS NOT NULL;