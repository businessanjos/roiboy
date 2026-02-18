
-- Add rsvp_form_fields to events and custom_data to event_participants
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rsvp_form_fields jsonb DEFAULT null;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT null;
