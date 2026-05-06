-- Fix outbound audios/medias that already have a permanent media_url but were stuck as pending/failed
UPDATE public.zapp_messages
SET media_download_status = 'completed', updated_at = now()
WHERE direction = 'outbound'
  AND media_url IS NOT NULL
  AND media_url LIKE '%supabase%'
  AND media_download_status IN ('pending', 'failed', 'downloading');

-- Reset stuck inbound failed media so the auto-retry picks them up
UPDATE public.zapp_messages
SET media_download_status = 'pending', updated_at = now()
WHERE direction = 'inbound'
  AND media_url IS NULL
  AND media_encrypted_url IS NOT NULL
  AND media_download_status = 'failed'
  AND sent_at > now() - interval '24 hours';