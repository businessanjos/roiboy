-- 1. Alterar função track_rsvp_engagement para SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.track_rsvp_engagement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando RSVP muda de pending para confirmed, é um sinal positivo
  IF NEW.rsvp_status = 'confirmed' AND OLD.rsvp_status = 'pending' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.roi_events (
      account_id, client_id, source, roi_type, category,
      evidence_snippet, impact, happened_at
    ) 
    SELECT 
      NEW.account_id, NEW.client_id, 'event_rsvp', 'intangible', 'status_direction',
      'Confirmou presença no evento: ' || COALESCE(e.title, 'Evento'),
      'low', NOW()
    FROM public.events e WHERE e.id = NEW.event_id;
  END IF;
  
  -- Quando marcado como presente
  IF NEW.rsvp_status = 'attended' AND OLD.rsvp_status != 'attended' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.roi_events (
      account_id, client_id, source, roi_type, category,
      evidence_snippet, impact, happened_at
    ) 
    SELECT 
      NEW.account_id, NEW.client_id, 'event_attendance', 'intangible', 'status_direction',
      'Participou do evento: ' || COALESCE(e.title, 'Evento'),
      'medium', NOW()
    FROM public.events e WHERE e.id = NEW.event_id;
  END IF;
  
  -- Quando não compareceu
  IF NEW.rsvp_status = 'no_show' AND OLD.rsvp_status != 'no_show' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.risk_events (
      account_id, client_id, source, risk_level, reason, detected_at
    ) 
    SELECT 
      NEW.account_id, NEW.client_id, 'event_no_show', 'low',
      'Não compareceu ao evento: ' || COALESCE(e.title, 'Evento'),
      NOW()
    FROM public.events e WHERE e.id = NEW.event_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Alterar função track_rsvp_response para SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.track_rsvp_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.rsvp_status = 'pending' OR OLD.rsvp_responded_at IS NULL) 
     AND NEW.rsvp_responded_at IS NOT NULL 
     AND NEW.rsvp_status IN ('confirmed', 'declined') THEN
    
    UPDATE public.reminder_recipients
    SET 
      responded_at = NEW.rsvp_responded_at,
      response_data = jsonb_build_object('rsvp_status', NEW.rsvp_status),
      whatsapp_status = CASE WHEN whatsapp_status = 'sent' THEN 'responded' ELSE whatsapp_status END,
      email_status = CASE WHEN email_status = 'sent' THEN 'responded' ELSE email_status END
    WHERE participant_id = NEW.id
      AND responded_at IS NULL;
    
    UPDATE public.reminder_campaigns rc
    SET responded_count = (
      SELECT COUNT(*) 
      FROM public.reminder_recipients rr 
      WHERE rr.campaign_id = rc.id AND rr.responded_at IS NOT NULL
    )
    WHERE id IN (
      SELECT campaign_id FROM public.reminder_recipients WHERE participant_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;