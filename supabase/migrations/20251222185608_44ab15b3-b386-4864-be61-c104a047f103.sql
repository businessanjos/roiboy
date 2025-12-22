-- Add ends_at column for multi-day events
ALTER TABLE public.events 
ADD COLUMN ends_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the field
COMMENT ON COLUMN public.events.ends_at IS 'End date/time for multi-day events. If null, event is single-day using duration_minutes.';