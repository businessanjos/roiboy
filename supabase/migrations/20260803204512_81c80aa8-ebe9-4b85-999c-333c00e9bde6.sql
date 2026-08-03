UPDATE public.zapp_messages
SET media_download_status = 'failed',
    media_download_attempts = 0,
    media_last_error = NULL,
    updated_at = now() - interval '10 minutes'
WHERE media_url IS NULL
  AND media_download_status = 'downloading'
  AND sent_at > now() - interval '3 days';