-- Normalize 33 messages with NULL media_download_status that have media_type but no media_url
UPDATE public.zapp_messages
SET media_download_status = 'pending'
WHERE media_download_status IS NULL
  AND media_type IS NOT NULL
  AND media_url IS NULL;