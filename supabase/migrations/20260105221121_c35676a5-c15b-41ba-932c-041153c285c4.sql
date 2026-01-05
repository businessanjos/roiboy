-- Add goal fields to events table for marketing event tracking
ALTER TABLE public.events 
ADD COLUMN goal_invited integer DEFAULT 0,
ADD COLUMN goal_confirmed integer DEFAULT 0,
ADD COLUMN goal_present integer DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.events.goal_invited IS 'Target number of invitations to send';
COMMENT ON COLUMN public.events.goal_confirmed IS 'Target number of confirmed attendees';
COMMENT ON COLUMN public.events.goal_present IS 'Target number of actual attendees';