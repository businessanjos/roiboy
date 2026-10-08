CREATE OR REPLACE FUNCTION public.audit_client_life_event_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := public.get_current_user_id();
  _name text; _email text; _client text; _action text; _row record;
  _details jsonb := '{}'::jsonb;
BEGIN
  _row := COALESCE(NEW, OLD);
  IF TG_OP = 'UPDATE' THEN
    IF NEW.send_status IS NOT DISTINCT FROM OLD.send_status
       AND NEW.force_send IS NOT DISTINCT FROM OLD.force_send
       AND NEW.message IS NOT DISTINCT FROM OLD.message
       AND NEW.scheduled_send_at IS NOT DISTINCT FROM OLD.scheduled_send_at
       AND NEW.event_date IS NOT DISTINCT FROM OLD.event_date THEN
      RETURN NEW;
    END IF;
    _action := 'update';
    _details := jsonb_build_object(
      'old', jsonb_build_object('send_status', OLD.send_status, 'force_send', OLD.force_send, 'scheduled_send_at', OLD.scheduled_send_at, 'event_date', OLD.event_date, 'message', left(OLD.message, 300)),
      'new', jsonb_build_object('send_status', NEW.send_status, 'force_send', NEW.force_send, 'scheduled_send_at', NEW.scheduled_send_at, 'event_date', NEW.event_date, 'message', left(NEW.message, 300), 'send_error', NEW.send_error));
  ELSIF TG_OP = 'INSERT' THEN
    _action := 'create';
    _details := jsonb_build_object('new', jsonb_build_object('send_status', NEW.send_status, 'event_date', NEW.event_date, 'scheduled_send_at', NEW.scheduled_send_at));
  ELSE
    _action := 'delete';
    _details := jsonb_build_object('old', jsonb_build_object('send_status', OLD.send_status, 'event_date', OLD.event_date, 'message', left(OLD.message, 300)));
  END IF;
  _details := _details || jsonb_build_object('title', _row.title, 'event_type', _row.event_type, 'client_id', _row.client_id);
  SELECT name, email INTO _name, _email FROM public.users WHERE id = _uid;
  SELECT full_name INTO _client FROM public.clients WHERE id = _row.client_id;
  INSERT INTO public.audit_logs (account_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, details)
  VALUES (_row.account_id, _uid, COALESCE(_name, CASE WHEN _uid IS NULL THEN 'Automação CX' END), _email, _action, 'cx_moment', _row.id, _client, _details);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_client_life_events ON public.client_life_events;
CREATE TRIGGER trg_audit_client_life_events
AFTER INSERT OR UPDATE OR DELETE ON public.client_life_events
FOR EACH ROW EXECUTE FUNCTION public.audit_client_life_event_change();