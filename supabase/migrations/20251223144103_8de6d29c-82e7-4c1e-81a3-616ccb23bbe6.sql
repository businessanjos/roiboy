-- Trigger: Create ROI event when client gives high NPS feedback
CREATE OR REPLACE FUNCTION public.create_roi_from_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only create ROI event for clients with high NPS (9-10 = promoter)
  IF NEW.client_id IS NOT NULL AND NEW.nps_score IS NOT NULL AND NEW.nps_score >= 9 THEN
    INSERT INTO public.roi_events (
      account_id,
      client_id,
      source,
      roi_type,
      category,
      evidence_snippet,
      impact,
      happened_at
    ) VALUES (
      NEW.account_id,
      NEW.client_id,
      'event_feedback',
      'intangible',
      'confidence',
      'NPS ' || NEW.nps_score || ' - Promotor em feedback de evento',
      CASE WHEN NEW.nps_score = 10 THEN 'high' ELSE 'medium' END,
      NEW.submitted_at
    );
  END IF;
  
  -- Create risk event for detractors (NPS <= 6)
  IF NEW.client_id IS NOT NULL AND NEW.nps_score IS NOT NULL AND NEW.nps_score <= 6 THEN
    INSERT INTO public.risk_events (
      account_id,
      client_id,
      source,
      risk_level,
      reason,
      detected_at
    ) VALUES (
      NEW.account_id,
      NEW.client_id,
      'event_feedback',
      CASE WHEN NEW.nps_score <= 4 THEN 'high' ELSE 'medium' END,
      'NPS ' || NEW.nps_score || ' - Detrator em feedback de evento',
      NEW.submitted_at
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_feedback_create_roi ON public.event_feedback;
CREATE TRIGGER on_feedback_create_roi
  AFTER INSERT ON public.event_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.create_roi_from_feedback();

-- Trigger: Create engagement signal when client confirms RSVP
CREATE OR REPLACE FUNCTION public.track_rsvp_engagement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- When RSVP changes from pending to confirmed, it's a positive engagement signal
  IF NEW.rsvp_status = 'confirmed' AND OLD.rsvp_status = 'pending' AND NEW.client_id IS NOT NULL THEN
    -- Insert into roi_events as an engagement signal
    INSERT INTO public.roi_events (
      account_id,
      client_id,
      source,
      roi_type,
      category,
      evidence_snippet,
      impact,
      happened_at
    ) 
    SELECT 
      NEW.account_id,
      NEW.client_id,
      'event_rsvp',
      'intangible',
      'status_direction',
      'Confirmou presença no evento: ' || COALESCE(e.title, 'Evento'),
      'low',
      NOW()
    FROM public.events e WHERE e.id = NEW.event_id;
  END IF;
  
  -- When marked as attended, create a stronger ROI event
  IF NEW.rsvp_status = 'attended' AND OLD.rsvp_status != 'attended' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.roi_events (
      account_id,
      client_id,
      source,
      roi_type,
      category,
      evidence_snippet,
      impact,
      happened_at
    ) 
    SELECT 
      NEW.account_id,
      NEW.client_id,
      'event_attendance',
      'intangible',
      'status_direction',
      'Participou do evento: ' || COALESCE(e.title, 'Evento'),
      'medium',
      NOW()
    FROM public.events e WHERE e.id = NEW.event_id;
  END IF;
  
  -- When no_show, create a risk event
  IF NEW.rsvp_status = 'no_show' AND OLD.rsvp_status != 'no_show' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.risk_events (
      account_id,
      client_id,
      source,
      risk_level,
      reason,
      detected_at
    ) 
    SELECT 
      NEW.account_id,
      NEW.client_id,
      'event_no_show',
      'low',
      'Não compareceu ao evento: ' || COALESCE(e.title, 'Evento'),
      NOW()
    FROM public.events e WHERE e.id = NEW.event_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_rsvp_engagement ON public.event_participants;
CREATE TRIGGER on_rsvp_engagement
  AFTER UPDATE OF rsvp_status ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.track_rsvp_engagement();