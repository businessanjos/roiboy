-- Add avatar_url column to zapp_conversations for storing WhatsApp profile pictures
ALTER TABLE public.zapp_conversations 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment
COMMENT ON COLUMN public.zapp_conversations.avatar_url IS 'WhatsApp profile picture URL from contact';