-- =====================================================
-- SECURITY: Multi-Tenant Messaging System Hardening
-- =====================================================

-- 1. Add UPDATE policy for zapp_messages
CREATE POLICY "Users can update zapp_messages in their account"
  ON public.zapp_messages
  FOR UPDATE
  TO public
  USING (account_id = get_user_account_id());

-- 2. Add DELETE policy for zapp_messages
CREATE POLICY "Users can delete zapp_messages in their account"
  ON public.zapp_messages
  FOR DELETE
  TO public
  USING (account_id = get_user_account_id());

-- 3. Performance indexes for security queries
CREATE INDEX IF NOT EXISTS idx_zapp_messages_account_conversation 
  ON zapp_messages(account_id, zapp_conversation_id);

CREATE INDEX IF NOT EXISTS idx_zapp_conversations_account_sector_phone 
  ON zapp_conversations(account_id, sector_id, phone_e164) 
  WHERE is_group = false;

CREATE INDEX IF NOT EXISTS idx_zapp_conversations_account_sector_group 
  ON zapp_conversations(account_id, sector_id, group_jid) 
  WHERE is_group = true;

-- 4. Composite index for message lookups by account and external ID
CREATE INDEX IF NOT EXISTS idx_zapp_messages_account_external 
  ON zapp_messages(account_id, external_message_id);

-- 5. Index for conversation assignments security
CREATE INDEX IF NOT EXISTS idx_zapp_conversation_assignments_account_dept 
  ON zapp_conversation_assignments(account_id, department_id);