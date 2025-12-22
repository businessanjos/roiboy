-- Add unique RSVP token to event_participants for public links
ALTER TABLE public.event_participants 
ADD COLUMN rsvp_token uuid DEFAULT gen_random_uuid() UNIQUE;

-- Create index for fast token lookup
CREATE INDEX idx_event_participants_rsvp_token ON public.event_participants(rsvp_token);

-- Create function to get participant by token (public access)
CREATE OR REPLACE FUNCTION public.get_participant_by_rsvp_token(p_token uuid)
RETURNS TABLE (
  participant_id uuid,
  event_id uuid,
  event_title text,
  event_description text,
  event_scheduled_at timestamptz,
  event_ends_at timestamptz,
  event_modality text,
  event_address text,
  event_meeting_url text,
  guest_name text,
  client_name text,
  rsvp_status text,
  rsvp_responded_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ep.id as participant_id,
    e.id as event_id,
    e.title as event_title,
    e.description as event_description,
    e.scheduled_at as event_scheduled_at,
    e.ends_at as event_ends_at,
    e.modality::text as event_modality,
    e.address as event_address,
    e.meeting_url as event_meeting_url,
    ep.guest_name,
    c.full_name as client_name,
    ep.rsvp_status::text as rsvp_status,
    ep.rsvp_responded_at
  FROM event_participants ep
  JOIN events e ON e.id = ep.event_id
  LEFT JOIN clients c ON c.id = ep.client_id
  WHERE ep.rsvp_token = p_token
  LIMIT 1;
$$;

-- Create function to submit RSVP response (public access)
CREATE OR REPLACE FUNCTION public.submit_rsvp_response(
  p_token uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid;
  v_current_status text;
BEGIN
  -- Validate status
  IF p_status NOT IN ('confirmed', 'declined') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido');
  END IF;

  -- Find participant
  SELECT id, rsvp_status::text INTO v_participant_id, v_current_status
  FROM event_participants
  WHERE rsvp_token = p_token;

  IF v_participant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  -- Update RSVP status
  UPDATE event_participants
  SET 
    rsvp_status = p_status::event_rsvp_status,
    rsvp_responded_at = now()
  WHERE id = v_participant_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', CASE 
      WHEN p_status = 'confirmed' THEN 'Presença confirmada com sucesso!'
      ELSE 'Resposta registrada. Obrigado por nos informar.'
    END
  );
END;
$$;