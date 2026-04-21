UPDATE public.integrations
SET 
  config = jsonb_set(
    jsonb_set(
      config,
      '{instance_token}',
      '"eaa7a041-2016-4aa4-9639-98e97df08ad9"'::jsonb
    ),
    '{instance_id}',
    '"ra9a189be745cc9"'::jsonb
  ),
  status = 'disconnected'
WHERE id = '65cbf5f6-3479-49d0-9465-3d53d4a76ff9';