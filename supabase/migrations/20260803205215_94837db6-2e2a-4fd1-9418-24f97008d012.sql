UPDATE public.zapp_messages
SET media_download_status = 'pending',
    media_download_attempts = 0,
    media_last_error = NULL,
    updated_at = now() - interval '10 minutes'
WHERE media_url IS NULL
  AND media_last_error LIKE 'Error: Media too large%'
  AND sent_at > now() - interval '3 days';