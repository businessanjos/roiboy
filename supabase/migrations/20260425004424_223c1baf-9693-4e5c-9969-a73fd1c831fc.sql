ALTER TABLE public.zapp_conversations
DROP CONSTRAINT IF EXISTS zapp_conversations_account_group_unique;

CREATE UNIQUE INDEX IF NOT EXISTS zapp_conversations_account_group_integration_unique
ON public.zapp_conversations (account_id, group_jid, integration_id)
WHERE is_group = true
  AND group_jid IS NOT NULL
  AND integration_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS zapp_conversations_account_group_sector_legacy_unique
ON public.zapp_conversations (account_id, group_jid, sector_id)
WHERE is_group = true
  AND group_jid IS NOT NULL
  AND integration_id IS NULL;