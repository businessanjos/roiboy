
CREATE OR REPLACE FUNCTION public.heal_pending_life_events_for_today(p_today_mmdd text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Reagenda eventos pending (sem scheduled_send_at) cuja data MM-DD = hoje
  -- Exclui pausados manualmente. Aplica também a recorrentes que ficaram "scheduled" em ano errado.
  UPDATE public.client_life_events
  SET scheduled_send_at = now() - interval '1 minute',
      send_status = 'scheduled',
      send_error = NULL
  WHERE event_date IS NOT NULL
    AND to_char(event_date, 'MM-DD') = p_today_mmdd
    AND COALESCE(send_error, '') NOT ILIKE '%PAUSADO MANUALMENTE%'
    AND sent_at IS NULL
    AND (
      -- Caso 1: pending sem agendamento
      (send_status = 'pending' AND scheduled_send_at IS NULL)
      OR
      -- Caso 2: scheduled mas com data futura > 6 meses (recorrente quebrado)
      (send_status = 'scheduled' AND scheduled_send_at > now() + interval '6 months')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.heal_pending_life_events_for_today(text) TO authenticated, service_role;
