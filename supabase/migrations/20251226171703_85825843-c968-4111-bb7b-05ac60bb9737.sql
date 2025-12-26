-- Add is_group column to zapp_conversations
ALTER TABLE public.zapp_conversations 
ADD COLUMN is_group boolean NOT NULL DEFAULT false;

-- Add group_jid column for group identifier (since phone_e164 is for individual contacts)
ALTER TABLE public.zapp_conversations 
ADD COLUMN group_jid text;

-- Create index for group lookups
CREATE INDEX idx_zapp_conversations_group_jid ON public.zapp_conversations(account_id, group_jid) WHERE group_jid IS NOT NULL;

-- Add sender info columns to zapp_messages for group messages
ALTER TABLE public.zapp_messages
ADD COLUMN sender_phone text,
ADD COLUMN sender_name text;