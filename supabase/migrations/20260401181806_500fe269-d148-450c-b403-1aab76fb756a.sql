
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to dispatch events to Clinica Ryka webhook via edge function
CREATE OR REPLACE FUNCTION public.dispatch_ryka_client_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event text;
  v_payload jsonb;
  v_supabase_url text;
  v_anon_key text;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

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

  PERFORM extensions.http_post(
    url := concat('https://mtzoavtbtqflufyccern.supabase.co/functions/v1/dispatch-ryka-events'),
    body := v_payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat('Bearer ', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA')
    )::jsonb
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Function to dispatch contract events
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

  PERFORM extensions.http_post(
    url := concat('https://mtzoavtbtqflufyccern.supabase.co/functions/v1/dispatch-ryka-events'),
    body := v_payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat('Bearer ', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA')
    )::jsonb
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on clients table
DROP TRIGGER IF EXISTS trg_dispatch_ryka_client ON public.clients;
CREATE TRIGGER trg_dispatch_ryka_client
  AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_ryka_client_event();

-- Trigger on client_contracts table
DROP TRIGGER IF EXISTS trg_dispatch_ryka_contract ON public.client_contracts;
CREATE TRIGGER trg_dispatch_ryka_contract
  AFTER INSERT OR UPDATE ON public.client_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_ryka_contract_event();
