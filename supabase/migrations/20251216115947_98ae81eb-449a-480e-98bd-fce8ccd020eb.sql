-- Add address column for in-person events
ALTER TABLE public.events 
ADD COLUMN address text;