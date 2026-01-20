-- Fix the track_rsvp_engagement trigger to use correct column name (happened_at instead of detected_at)
CREATE OR REPLACE FUNCTION public.track_rsvp_engagement()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando RSVP muda de pending para confirmed
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
  
  -- Quando não compareceu - CORRIGIDO: usar happened_at em vez de detected_at
  IF NEW.rsvp_status = 'no_show' AND OLD.rsvp_status != 'no_show' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.risk_events (
      account_id, client_id, source, risk_level, reason, happened_at
    ) 
    SELECT 
      NEW.account_id, NEW.client_id, 'event_no_show', 'low',
      'Não compareceu ao evento: ' || COALESCE(e.title, 'Evento'),
      NOW()
    FROM public.events e WHERE e.id = NEW.event_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;