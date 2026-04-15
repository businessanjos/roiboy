
CREATE OR REPLACE FUNCTION public.dispatch_ryka_contract_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'contract.created';
    v_payload := jsonb_build_object(
      'event', v_event,
      'record', row_to_json(NEW)::jsonb
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_event := 'contract.updated';
    v_payload := jsonb_build_object(
      'event', v_event,
      'record', row_to_json(NEW)::jsonb,
      'old_record', row_to_json(OLD)::jsonb
    );
  END IF;

  BEGIN
    PERFORM extensions.http_post(
      url := concat('https://mtzoavtbtqflufyccern.supabase.co/functions/v1/dispatch-ryka-events'),
      body := v_payload::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA')
      )::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_ryka_contract_event failed: %', SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_ryka_client_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'client.created';
    v_payload := jsonb_build_object(
      'event', v_event,
      'record', row_to_json(NEW)::jsonb
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_event := 'client.updated';
    v_payload := jsonb_build_object(
      'event', v_event,
      'record', row_to_json(NEW)::jsonb,
      'old_record', row_to_json(OLD)::jsonb
    );
  END IF;

  BEGIN
    PERFORM extensions.http_post(
      url := concat('https://mtzoavtbtqflufyccern.supabase.co/functions/v1/dispatch-ryka-events'),
      body := v_payload::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA')
      )::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_ryka_client_event failed: %', SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;
