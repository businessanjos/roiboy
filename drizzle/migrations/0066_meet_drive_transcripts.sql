ALTER TABLE public.video_call_sessions ADD COLUMN IF NOT EXISTS drive_file_id text;
CREATE UNIQUE INDEX IF NOT EXISTS video_call_sessions_account_drive_file_uidx
  ON public.video_call_sessions(account_id, drive_file_id) WHERE drive_file_id IS NOT NULL;