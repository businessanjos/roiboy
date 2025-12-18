-- Add event_id to attendance table for presencial events
ALTER TABLE public.attendance 
ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
ALTER COLUMN live_session_id DROP NOT NULL;

-- Add unique checkin code to events
ALTER TABLE public.events 
ADD COLUMN checkin_code text UNIQUE;

-- Create index for checkin lookups
CREATE INDEX idx_events_checkin_code ON public.events(checkin_code) WHERE checkin_code IS NOT NULL;

-- Create index for event attendance
CREATE INDEX idx_attendance_event_id ON public.attendance(event_id) WHERE event_id IS NOT NULL;

-- Update RLS policies to allow public check-in insert
CREATE POLICY "Allow public event check-in" 
ON public.attendance 
FOR INSERT 
WITH CHECK (
  event_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id 
    AND e.checkin_code IS NOT NULL
    AND e.modality = 'presencial'
  )
);

-- Function to generate unique checkin code
CREATE OR REPLACE FUNCTION public.generate_checkin_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    -- Generate 6 character alphanumeric code
    new_code := upper(substr(md5(random()::text), 1, 6));
    
    -- Check if code already exists
    SELECT EXISTS (SELECT 1 FROM public.events WHERE checkin_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;