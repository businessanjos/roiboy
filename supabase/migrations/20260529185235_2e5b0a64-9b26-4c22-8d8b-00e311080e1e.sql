-- Resolver envio de aniversário da Cristina Zottarelli: deduplica e reagenda para agora
DELETE FROM public.client_life_events WHERE id = 'ae92cf35-9146-405d-8097-16222f3e5a13';

UPDATE public.client_life_events
SET scheduled_send_at = now() - interval '1 minute',
    send_status = 'scheduled',
    send_error = NULL
WHERE id = '5402bae0-1a83-4ad8-8f49-75d0cc6b87fd';