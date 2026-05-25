UPDATE public.client_life_events
SET send_status = 'scheduled', send_error = NULL
WHERE send_status = 'failed'
  AND (send_error ILIKE '%Nenhum WhatsApp conectado%' OR send_error ILIKE '%integration not configured%')
  AND scheduled_send_at IS NOT NULL;