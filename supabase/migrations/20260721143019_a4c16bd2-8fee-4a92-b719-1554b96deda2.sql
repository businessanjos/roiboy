ALTER TABLE public.zapp_messages
  ADD COLUMN IF NOT EXISTS media_download_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_zapp_messages_media_retry
  ON public.zapp_messages (media_download_status, media_last_attempt_at)
  WHERE media_encrypted_url IS NOT NULL
    AND media_url IS NULL
    AND media_download_status IN ('pending','failed','downloading');