CREATE OR REPLACE FUNCTION public.tg_notify_cs_briefing_saved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_actor uuid;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, full_name, account_id, responsible_user_id
    INTO v_client
    FROM public.clients
   WHERE id = NEW.client_id;

  IF v_client.id IS NULL OR v_client.responsible_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_actor FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  IF v_actor IS NOT NULL AND v_actor = v_client.responsible_user_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications
     WHERE user_id = v_client.responsible_user_id
       AND source_type = 'deal_operation_briefing'
       AND source_id = NEW.id
       AND is_read = false
       AND created_at > now() - interval '10 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    account_id, user_id, type, title, content, link,
    source_type, source_id, triggered_by_user_id, sector_id
  ) VALUES (
    v_client.account_id,
    v_client.responsible_user_id,
    'briefing',
    'Briefing comercial atualizado',
    'O briefing de ' || COALESCE(v_client.full_name, 'cliente') || ' foi salvo pelo Comercial e já está na ficha.',
    '/clients/' || v_client.id::text || '?tab=briefing',
    'deal_operation_briefing',
    NEW.id,
    v_actor,
    'operacoes'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cs_briefing_saved ON public.deal_operation_briefings;

CREATE TRIGGER trg_notify_cs_briefing_saved
AFTER INSERT OR UPDATE ON public.deal_operation_briefings
FOR EACH ROW
EXECUTE FUNCTION public.tg_notify_cs_briefing_saved();