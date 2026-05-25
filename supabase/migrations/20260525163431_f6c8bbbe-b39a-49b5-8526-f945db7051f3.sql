UPDATE public.client_life_events
SET send_status = 'scheduled', send_error = NULL
WHERE send_status = 'failed'
  AND (
    send_error ILIKE '%Nenhum WhatsApp%'
    OR send_error ILIKE '%Token%'
    OR send_error ILIKE '%não suportado%'
    OR send_error ILIKE '%Not Found%'
    OR send_error ILIKE '%404%'
  );