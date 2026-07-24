
UPDATE public.sector_settings
   SET royzapp_host = 'https://eternum-roy.uazapi.com',
       royzapp_admin_token_secret_name = 'UAZAPI_ETERNUM_ROY_ADMIN_TOKEN',
       updated_at = now()
 WHERE sector_id = 'operacoes';

UPDATE public.integrations
   SET status = 'disconnected',
       config = (config
                 - 'instance_id'
                 - 'instance_token'
                 - 'admin_token'
                 - 'connection_state'
                 - 'webhook_configured'
                 - 'last_webhook_at'
                 - 'owner')
              || jsonb_build_object(
                   'host_url', 'https://eternum-roy.uazapi.com',
                   'provider', 'uazapi',
                   'migrated_from', 'cs-roy-eternum.uazapi.com',
                   'migrated_at', now()
                 )
 WHERE id = '65cbf5f6-3479-49d0-9465-3d53d4a76ff9';
