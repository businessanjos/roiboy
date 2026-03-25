
-- PERFORMANCE INDEXES FOR HIGH-VOLUME WHATSAPP
-- (Retry without external_id index)

-- 1. zapp_messages: Deduplication queries (external_message_id lookups)
CREATE INDEX IF NOT EXISTS idx_zapp_messages_external_msg_id 
ON public.zapp_messages (external_message_id) 
WHERE external_message_id IS NOT NULL;

-- 2. zapp_messages: Outbound dedup query (conversation + direction + recent)
CREATE INDEX IF NOT EXISTS idx_zapp_messages_conv_dir_created 
ON public.zapp_messages (zapp_conversation_id, direction, created_at DESC);

-- 3. zapp_conversations: Direct message lookup (phone + integration)
CREATE INDEX IF NOT EXISTS idx_zapp_conv_phone_integration 
ON public.zapp_conversations (account_id, phone_e164, integration_id) 
WHERE is_group = false;

-- 4. zapp_conversations: Group lookup (group_jid + integration)
CREATE INDEX IF NOT EXISTS idx_zapp_conv_group_integration 
ON public.zapp_conversations (account_id, group_jid, integration_id) 
WHERE is_group = true AND group_jid IS NOT NULL;

-- 5. zapp_conversation_assignments: Department + status queries
CREATE INDEX IF NOT EXISTS idx_zapp_assign_dept_status 
ON public.zapp_conversation_assignments (account_id, department_id, status, updated_at DESC);

-- 6. zapp_conversation_assignments: Conversation lookup
CREATE INDEX IF NOT EXISTS idx_zapp_assign_conv_id 
ON public.zapp_conversation_assignments (account_id, zapp_conversation_id);

-- 7. integrations: Instance lookup
CREATE INDEX IF NOT EXISTS idx_integrations_instance_name 
ON public.integrations ((config->>'instance_name')) 
WHERE type = 'whatsapp';

-- 8. integrations: Token lookup
CREATE INDEX IF NOT EXISTS idx_integrations_instance_token 
ON public.integrations ((config->>'instance_token')) 
WHERE type = 'whatsapp';

-- 9. ai_analysis_queue: Pending jobs processing
CREATE INDEX IF NOT EXISTS idx_ai_queue_status_priority 
ON public.ai_analysis_queue (status, priority, created_at) 
WHERE status = 'pending';

-- 10. clients: Phone lookup
CREATE INDEX IF NOT EXISTS idx_clients_account_phone 
ON public.clients (account_id, phone_e164);
