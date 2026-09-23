ALTER TABLE public.video_call_sessions
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS transcript_file_name text;

ALTER TABLE public.video_call_sessions ALTER COLUMN daily_room_name DROP NOT NULL;
ALTER TABLE public.video_call_sessions ALTER COLUMN daily_room_url DROP NOT NULL;