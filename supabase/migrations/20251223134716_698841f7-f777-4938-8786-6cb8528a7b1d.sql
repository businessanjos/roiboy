-- Add is_external column to event_team table
ALTER TABLE public.event_team
ADD COLUMN is_external boolean NOT NULL DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN public.event_team.is_external IS 'Indicates if the team member is external (true) or internal (false)';