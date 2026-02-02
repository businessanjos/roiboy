-- Add RSVP closure columns to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS rsvp_closed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS rsvp_deadline timestamptz,
ADD COLUMN IF NOT EXISTS rsvp_closure_message text;

-- Add comment for documentation
COMMENT ON COLUMN public.events.rsvp_closed IS 'Manual closure toggle for RSVP confirmations';
COMMENT ON COLUMN public.events.rsvp_deadline IS 'Automatic deadline for RSVP confirmations';
COMMENT ON COLUMN public.events.rsvp_closure_message IS 'Custom message shown when RSVP is closed';

-- Drop existing function to change return type
DROP FUNCTION IF EXISTS public.get_participant_by_rsvp_token(uuid);

-- Recreate get_participant_by_rsvp_token with RSVP closure fields
CREATE OR REPLACE FUNCTION public.get_participant_by_rsvp_token(p_token uuid)
 RETURNS TABLE(
   participant_id uuid, 
   event_id uuid, 
   event_title text, 
   event_description text, 
   event_scheduled_at timestamp with time zone, 
   event_ends_at timestamp with time zone, 
   event_modality text, 
   event_address text, 
   event_meeting_url text, 
   guest_name text, 
   client_name text, 
   rsvp_status text, 
   rsvp_responded_at timestamp with time zone,
   event_rsvp_closed boolean,
   event_rsvp_deadline timestamp with time zone,
   event_rsvp_closure_message text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ep.rsvp_responded_at,
    e.rsvp_closed as event_rsvp_closed,
    e.rsvp_deadline as event_rsvp_deadline,
    e.rsvp_closure_message as event_rsvp_closure_message
  FROM event_participants ep
  JOIN events e ON e.id = ep.event_id
  LEFT JOIN clients c ON c.id = ep.client_id
  WHERE ep.rsvp_token = p_token
  LIMIT 1;
$function$;

-- Update submit_rsvp_response to validate RSVP closure
CREATE OR REPLACE FUNCTION public.submit_rsvp_response(p_token uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_participant_id uuid;
  v_event_id uuid;
  v_current_status text;
  v_rsvp_closed boolean;
  v_rsvp_deadline timestamptz;
BEGIN
  -- Validate status
  IF p_status NOT IN ('confirmed', 'declined') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido');
  END IF;

  -- Find participant and event
  SELECT ep.id, ep.event_id, ep.rsvp_status::text 
  INTO v_participant_id, v_event_id, v_current_status
  FROM event_participants ep
  WHERE ep.rsvp_token = p_token;

  IF v_participant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  -- Check if RSVP is closed
  SELECT rsvp_closed, rsvp_deadline 
  INTO v_rsvp_closed, v_rsvp_deadline
  FROM events 
  WHERE id = v_event_id;

  IF v_rsvp_closed OR (v_rsvp_deadline IS NOT NULL AND now() > v_rsvp_deadline) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'As confirmações para este evento foram encerradas.'
    );
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
$function$;