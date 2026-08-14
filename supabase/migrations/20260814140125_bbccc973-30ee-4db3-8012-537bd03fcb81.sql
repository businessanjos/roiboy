-- Function: marca como concluídos os eventos cuja data final já passou
CREATE OR REPLACE FUNCTION public.autocomplete_past_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.events
     SET status = 'completed',
         updated_at = now()
   WHERE COALESCE(status, 'draft') NOT IN ('completed', 'cancelled')
     AND COALESCE(ends_at, scheduled_at) IS NOT NULL
     AND COALESCE(ends_at, scheduled_at) < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Trigger: garante consistência imediata ao criar/editar um evento
CREATE OR REPLACE FUNCTION public.tg_events_autocomplete_past()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.status, 'draft') NOT IN ('completed', 'cancelled')
     AND COALESCE(NEW.ends_at, NEW.scheduled_at) IS NOT NULL
     AND COALESCE(NEW.ends_at, NEW.scheduled_at) < now() THEN
    NEW.status := 'completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_autocomplete_past ON public.events;
CREATE TRIGGER events_autocomplete_past
BEFORE INSERT OR UPDATE OF scheduled_at, ends_at, status ON public.events
FOR EACH ROW EXECUTE FUNCTION public.tg_events_autocomplete_past();

GRANT EXECUTE ON FUNCTION public.autocomplete_past_events() TO authenticated, service_role;