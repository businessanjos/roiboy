-- Add conversation management columns to zapp_conversations
ALTER TABLE public.zapp_conversations
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS pinned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS muted_until timestamp with time zone;

-- Create index for pinned conversations (they appear first)
CREATE INDEX IF NOT EXISTS idx_zapp_conversations_pinned ON public.zapp_conversations(account_id, is_pinned, pinned_at DESC);