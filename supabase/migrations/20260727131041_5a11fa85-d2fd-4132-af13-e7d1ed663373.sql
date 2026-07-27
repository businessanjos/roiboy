UPDATE public.integrations
SET status = 'connected',
    config = (config
      - 'disconnect_reason'
      - 'manual_reconnect_required')
      || jsonb_build_object(
        'connection_state', 'open',
        'webhook_configured', true,
        'webhook_url', 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/uazapi-webhook',
        'webhook_reenabled_at', now()
      )
WHERE id = '65cbf5f6-3479-49d0-9465-3d53d4a76ff9';