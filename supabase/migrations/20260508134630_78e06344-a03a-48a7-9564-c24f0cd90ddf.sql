-- Add sender_user_id to zapp_messages so we can attribute outbound messages
-- to a specific closer/agent (multiple users may share a single WhatsApp instance).
ALTER TABLE public.zapp_messages
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Index to support per-user duplicate / rate-limit checks (anti-spam)
CREATE INDEX IF NOT EXISTS idx_zapp_messages_sender_user_created
  ON public.zapp_messages (sender_user_id, created_at DESC)
  WHERE sender_user_id IS NOT NULL;

COMMENT ON COLUMN public.zapp_messages.sender_user_id IS
  'Public users.id of the closer/agent who sent this outbound message. NULL for inbound (client) messages and webhook-imported history.';