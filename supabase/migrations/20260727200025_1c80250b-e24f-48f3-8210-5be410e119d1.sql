ALTER TABLE public.zapp_messages
  ADD COLUMN IF NOT EXISTS transcription_status text,
  ADD COLUMN IF NOT EXISTS transcription_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transcription_error text,
  ADD COLUMN IF NOT EXISTS transcription_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcription_next_retry_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_zapp_messages_transcription_retry
  ON public.zapp_messages (transcription_next_retry_at)
  WHERE transcription_status = 'failed';