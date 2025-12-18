-- Add group message support columns to message_events
ALTER TABLE public.message_events 
ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS group_name text;