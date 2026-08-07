CREATE OR REPLACE FUNCTION public.heal_pending_life_events_for_today(p_today_mmdd text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.client_life_events
  SET scheduled_send_at = now() - interval '1 minute',
      send_status = 'scheduled',
      send_error = NULL
  WHERE event_date IS NOT NULL
    AND to_char(event_date, 'MM-DD') = p_today_mmdd
    AND COALESCE(send_error, '') NOT ILIKE '%PAUSADO MANUALMENTE%'
    AND sent_at IS NULL
    AND (
      (send_status = 'pending' AND scheduled_send_at IS NULL)
      OR
      (send_status = 'scheduled' AND scheduled_send_at > now() + interval '6 months')
      OR
      -- Retry today's transient failures (host/connection/empty message) once per day
      (send_status = 'failed'
        AND (scheduled_send_at IS NULL OR scheduled_send_at < date_trunc('day', now()))
        AND (
          COALESCE(send_error,'') ILIKE '%host not mapped%'
          OR COALESCE(send_error,'') ILIKE '%disconnected%'
          OR COALESCE(send_error,'') ILIKE '%Mensagem está vazia%'
          OR COALESCE(send_error,'') ILIKE '%Failed to fetch%'
          OR COALESCE(send_error,'') ILIKE '%não configurado%'
          OR COALESCE(send_error,'') ILIKE '%Nenhum WhatsApp%'
        )
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.heal_pending_life_events_for_today(text) TO authenticated, service_role;