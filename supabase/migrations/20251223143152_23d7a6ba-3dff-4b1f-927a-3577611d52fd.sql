-- Create function to track RSVP responses and update campaign stats
CREATE OR REPLACE FUNCTION public.track_rsvp_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- When RSVP status changes from pending to confirmed/declined
  IF (OLD.rsvp_status = 'pending' OR OLD.rsvp_responded_at IS NULL) 
     AND NEW.rsvp_responded_at IS NOT NULL 
     AND NEW.rsvp_status IN ('confirmed', 'declined') THEN
    
    -- Update any reminder_recipients that sent to this participant
    UPDATE public.reminder_recipients
    SET 
      responded_at = NEW.rsvp_responded_at,
      response_data = jsonb_build_object('rsvp_status', NEW.rsvp_status),
      whatsapp_status = CASE WHEN whatsapp_status = 'sent' THEN 'responded' ELSE whatsapp_status END,
      email_status = CASE WHEN email_status = 'sent' THEN 'responded' ELSE email_status END
    WHERE participant_id = NEW.id
      AND responded_at IS NULL;
    
    -- Update campaign responded_count
    UPDATE public.reminder_campaigns rc
    SET responded_count = (
      SELECT COUNT(*) 
      FROM public.reminder_recipients rr 
      WHERE rr.campaign_id = rc.id AND rr.responded_at IS NOT NULL
    )
    WHERE id IN (
      SELECT campaign_id 
      FROM public.reminder_recipients 
      WHERE participant_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS on_rsvp_response ON public.event_participants;
CREATE TRIGGER on_rsvp_response
  AFTER UPDATE OF rsvp_status, rsvp_responded_at ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.track_rsvp_response();

-- Also track feedback responses
CREATE OR REPLACE FUNCTION public.track_feedback_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Update any reminder_recipients that sent feedback request to this participant/client
  UPDATE public.reminder_recipients rr
  SET 
    responded_at = NEW.submitted_at,
    response_data = jsonb_build_object(
      'feedback_id', NEW.id,
      'nps_score', NEW.nps_score,
      'overall_rating', NEW.overall_rating
    ),
    whatsapp_status = CASE WHEN whatsapp_status = 'sent' THEN 'responded' ELSE whatsapp_status END,
    email_status = CASE WHEN email_status = 'sent' THEN 'responded' ELSE email_status END
  FROM public.reminder_campaigns rc
  WHERE rr.campaign_id = rc.id
    AND rc.event_id = NEW.event_id
    AND rc.campaign_type = 'feedback'
    AND (
      (NEW.client_id IS NOT NULL AND rr.client_id = NEW.client_id)
      OR (NEW.participant_id IS NOT NULL AND rr.participant_id = NEW.participant_id)
    )
    AND rr.responded_at IS NULL;
  
  -- Update campaign responded_count
  UPDATE public.reminder_campaigns rc
  SET responded_count = (
    SELECT COUNT(*) 
    FROM public.reminder_recipients rr 
    WHERE rr.campaign_id = rc.id AND rr.responded_at IS NOT NULL
  )
  WHERE rc.event_id = NEW.event_id
    AND rc.campaign_type = 'feedback';
  
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS on_feedback_response ON public.event_feedback;
CREATE TRIGGER on_feedback_response
  AFTER INSERT ON public.event_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.track_feedback_response();