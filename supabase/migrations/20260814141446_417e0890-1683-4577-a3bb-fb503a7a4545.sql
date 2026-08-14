ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS auto_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reminder_types text[] NOT NULL DEFAULT ARRAY['rsvp_reminder','pre_event_24h','checkin_day','post_event_feedback']::text[];

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reminder_campaigns_event_auto_type
  ON public.reminder_campaigns (event_id, auto_type)
  WHERE auto_type IS NOT NULL;