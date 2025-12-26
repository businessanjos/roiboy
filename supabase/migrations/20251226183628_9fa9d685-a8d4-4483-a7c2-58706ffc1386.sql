-- Drop the existing unique constraint that doesn't work well with groups
ALTER TABLE public.zapp_conversations 
DROP CONSTRAINT IF EXISTS zapp_conversations_account_id_phone_e164_key;

-- Create a new partial unique index for non-group conversations (by phone)
CREATE UNIQUE INDEX IF NOT EXISTS zapp_conversations_account_phone_unique 
ON public.zapp_conversations (account_id, phone_e164) 
WHERE is_group = false;

-- Create a new partial unique index for group conversations (by group_jid)
CREATE UNIQUE INDEX IF NOT EXISTS zapp_conversations_account_group_unique 
ON public.zapp_conversations (account_id, group_jid) 
WHERE is_group = true AND group_jid IS NOT NULL;