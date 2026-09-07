CREATE OR REPLACE FUNCTION public.enqueue_traffic_hub_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_active boolean;
  v_should_ping boolean := false;
BEGIN
  BEGIN
    SELECT (s.is_active AND coalesce(s.endpoint_url, '') <> '') INTO v_active
    FROM public.traffic_hub_settings s WHERE s.account_id = NEW.account_id;

    IF NEW.status = 'won' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'won') THEN
      INSERT INTO public.traffic_hub_deliveries (account_id, deal_id, event_type, stage_id, status, next_attempt_at)
      VALUES (NEW.account_id, NEW.id, 'sale', NULL, 'pending', now())
      ON CONFLICT (deal_id, event_type, stage_id) DO UPDATE
        SET status = 'pending', next_attempt_at = now(), attempts = 0, last_error = NULL, sent_at = NULL;
      v_should_ping := true;
    END IF;

    IF NEW.status = 'lost' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'lost') THEN
      INSERT INTO public.traffic_hub_deliveries (account_id, deal_id, event_type, stage_id, status, next_attempt_at)
      VALUES (NEW.account_id, NEW.id, 'lost', NULL, 'pending', now())
      ON CONFLICT (deal_id, event_type, stage_id) DO UPDATE
        SET status = 'pending', next_attempt_at = now(), attempts = 0, last_error = NULL, sent_at = NULL;
      v_should_ping := true;
    END IF;

    IF NEW.stage_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
      INSERT INTO public.traffic_hub_deliveries (account_id, deal_id, event_type, stage_id, status, next_attempt_at)
      VALUES (NEW.account_id, NEW.id, 'stage', NEW.stage_id, 'pending', now())
      ON CONFLICT (deal_id, event_type, stage_id) DO UPDATE
        SET status = 'pending', next_attempt_at = now(), attempts = 0, last_error = NULL, sent_at = NULL;
      v_should_ping := true;
    END IF;

    IF v_should_ping AND coalesce(v_active, false) THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/traffic-hub-dispatch',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object('source', 'trigger', 'deal_id', NEW.id)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  RETURN NEW;
END;
$fn$;