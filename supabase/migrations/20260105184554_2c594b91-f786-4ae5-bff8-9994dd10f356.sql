-- Add sector_id to zapp_conversations for multi-sector isolation
ALTER TABLE public.zapp_conversations 
ADD COLUMN sector_id TEXT;

-- Add comment
COMMENT ON COLUMN public.zapp_conversations.sector_id IS 'Sector identifier for multi-sector WhatsApp isolation';

-- Create index for fast lookups by account + phone + sector
CREATE INDEX IF NOT EXISTS idx_zapp_conversations_account_phone_sector 
ON public.zapp_conversations(account_id, phone_e164, sector_id) 
WHERE is_group = false;

-- Create index for group lookups by account + group_jid + sector
CREATE INDEX IF NOT EXISTS idx_zapp_conversations_account_group_sector 
ON public.zapp_conversations(account_id, group_jid, sector_id) 
WHERE is_group = true;

-- Backfill existing conversations with sector_id from their assignments
UPDATE public.zapp_conversations c
SET sector_id = d.sector_id
FROM public.zapp_conversation_assignments a
JOIN public.zapp_departments d ON d.id = a.department_id
WHERE c.id = a.zapp_conversation_id
  AND c.sector_id IS NULL;