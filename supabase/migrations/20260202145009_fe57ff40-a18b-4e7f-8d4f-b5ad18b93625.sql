-- Remove old index that only allowed ONE conversation per phone per account
DROP INDEX IF EXISTS zapp_conversations_account_phone_unique;
DROP INDEX IF EXISTS zapp_conversations_unique_phone_idx;

-- Create new index that allows ONE conversation per phone PER INSTANCE
-- This enables each WhatsApp instance to have its own separate conversation with the same contact
CREATE UNIQUE INDEX zapp_conversations_account_phone_integration_unique 
ON zapp_conversations (account_id, phone_e164, integration_id) 
WHERE (is_group = false AND phone_e164 IS NOT NULL AND integration_id IS NOT NULL);