UPDATE public.integrations
SET status = 'disconnected',
    config = config || jsonb_build_object(
      'connection_state', 'close',
      'disconnect_reason', 'Deslogado no aparelho (401: logged out from another device) em 2026-07-27 12:04 UTC. Reconectar lendo o QR Code.',
      'manual_reconnect_required', true
    )
WHERE id = '65cbf5f6-3479-49d0-9465-3d53d4a76ff9';