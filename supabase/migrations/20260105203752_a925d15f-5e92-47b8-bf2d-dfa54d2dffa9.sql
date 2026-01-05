-- Add time fields to marketing_events
ALTER TABLE public.marketing_events 
ADD COLUMN start_time time without time zone,
ADD COLUMN end_time time without time zone;