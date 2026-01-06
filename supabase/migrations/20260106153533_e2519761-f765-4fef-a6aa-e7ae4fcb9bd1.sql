-- Add column to control if event allows external guests
ALTER TABLE public.events 
ADD COLUMN allow_external_guests boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.events.allow_external_guests IS 'When true, event appears in commercial RoyZapp for inviting prospects';