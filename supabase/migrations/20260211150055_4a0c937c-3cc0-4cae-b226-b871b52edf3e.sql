
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
ALTER TABLE public.internal_tasks ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
