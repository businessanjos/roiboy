-- ============================================
-- STEP 1: Clean up existing duplicates
-- Move messages from legacy conversations to the active ones
-- ============================================

-- 1.1 Move all messages from legacy (NULL integration_id) to active conversations
WITH duplicates AS (
  SELECT 
    c1.id as keep_id,
    c2.id as delete_id
  FROM zapp_conversations c1
  JOIN zapp_conversations c2 ON 
    c1.account_id = c2.account_id 
    AND c1.phone_e164 = c2.phone_e164
    AND c1.sector_id = c2.sector_id
    AND c1.is_group = false
    AND c2.is_group = false
    AND c1.integration_id IS NOT NULL
    AND c2.integration_id IS NULL
    AND c1.id != c2.id
)
UPDATE zapp_messages 
SET zapp_conversation_id = duplicates.keep_id
FROM duplicates 
WHERE zapp_messages.zapp_conversation_id = duplicates.delete_id;

-- 1.2 Delete assignments from legacy conversations
WITH duplicates AS (
  SELECT 
    c1.id as keep_id,
    c2.id as delete_id
  FROM zapp_conversations c1
  JOIN zapp_conversations c2 ON 
    c1.account_id = c2.account_id 
    AND c1.phone_e164 = c2.phone_e164
    AND c1.sector_id = c2.sector_id
    AND c1.is_group = false
    AND c2.is_group = false
    AND c1.integration_id IS NOT NULL
    AND c2.integration_id IS NULL
    AND c1.id != c2.id
)
DELETE FROM zapp_conversation_assignments 
WHERE zapp_conversation_id IN (SELECT delete_id FROM duplicates);

-- 1.3 Delete the legacy duplicate conversations
WITH duplicates AS (
  SELECT 
    c1.id as keep_id,
    c2.id as delete_id
  FROM zapp_conversations c1
  JOIN zapp_conversations c2 ON 
    c1.account_id = c2.account_id 
    AND c1.phone_e164 = c2.phone_e164
    AND c1.sector_id = c2.sector_id
    AND c1.is_group = false
    AND c2.is_group = false
    AND c1.integration_id IS NOT NULL
    AND c2.integration_id IS NULL
    AND c1.id != c2.id
)
DELETE FROM zapp_conversations 
WHERE id IN (SELECT delete_id FROM duplicates);

-- ============================================
-- STEP 2: Create unique index for legacy conversations
-- This prevents future duplicates when integration_id is NULL
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS zapp_conversations_account_phone_sector_legacy_unique 
ON public.zapp_conversations (account_id, phone_e164, sector_id) 
WHERE (
  is_group = false 
  AND phone_e164 IS NOT NULL 
  AND integration_id IS NULL
);