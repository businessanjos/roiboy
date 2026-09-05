ALTER TABLE public.traffic_hub_deliveries
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS stage_id uuid;

ALTER TABLE public.traffic_hub_deliveries DROP CONSTRAINT IF EXISTS traffic_hub_deliveries_deal_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_traffic_hub_deliveries_event
  ON public.traffic_hub_deliveries (deal_id, event_type, coalesce(stage_id::text, ''));

CREATE OR REPLACE FUNCTION public.enqueue_traffic_hub_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active boolean;
  v_should_ping boolean := false;
BEGIN
  SELECT (s.is_active AND coalesce(s.endpoint_url, '') <> '') INTO v_active
  FROM public.traffic_hub_settings s WHERE s.account_id = NEW.account_id;

  -- Evento de venda ganha
  IF NEW.status = 'won' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'won') THEN
    INSERT INTO public.traffic_hub_deliveries (account_id, deal_id, event_type, stage_id, status, next_attempt_at)
    VALUES (NEW.account_id, NEW.id, 'sale', NULL, 'pending', now())
    ON CONFLICT (deal_id, event_type, coalesce(stage_id::text, '')) DO UPDATE
      SET status = 'pending', next_attempt_at = now(), attempts = 0, last_error = NULL;
    v_should_ping := true;
  END IF;

  -- Evento de etapa (criação ou mudança de etapa)
  IF NEW.stage_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
    INSERT INTO public.traffic_hub_deliveries (account_id, deal_id, event_type, stage_id, status, next_attempt_at)
    VALUES (NEW.account_id, NEW.id, 'stage', NEW.stage_id, 'pending', now())
    ON CONFLICT (deal_id, event_type, coalesce(stage_id::text, '')) DO UPDATE
      SET status = 'pending', next_attempt_at = now(), attempts = 0, last_error = NULL, sent_at = NULL;
    v_should_ping := true;
  END IF;

  IF v_should_ping AND coalesce(v_active, false) THEN
    PERFORM net.http_post(
      url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/traffic-hub-dispatch',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA"}'::jsonb,
      body := jsonb_build_object('source', 'trigger', 'deal_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enqueue_traffic_hub_delivery ON public.deals;
CREATE TRIGGER trg_enqueue_traffic_hub_delivery
AFTER INSERT OR UPDATE OF status, stage_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.enqueue_traffic_hub_delivery();