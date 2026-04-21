UPDATE public.integrations
SET config = config 
  || jsonb_build_object('host_url', 'https://cs-roy-eternum.uazapi.com')
  || jsonb_build_object('admin_token', '6Kihsb1KWAMkWFiDPYpnOw2gnDtx31lv0Jx9ehDepNOXBNGvWl'),
  display_name = COALESCE(NULLIF(display_name, ''), '[CANAL] Eternum Club')
WHERE id = '65cbf5f6-3479-49d0-9465-3d53d4a76ff9';