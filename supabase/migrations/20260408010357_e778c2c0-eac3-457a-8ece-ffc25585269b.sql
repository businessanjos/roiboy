
-- Fix existing audio messages that already have permanent Supabase Storage URLs
-- but are incorrectly stuck with media_download_status = 'pending'
UPDATE zapp_messages
SET media_download_status = 'completed',
    updated_at = now()
WHERE media_download_status = 'pending'
  AND media_url IS NOT NULL
  AND media_url LIKE '%supabase%'
  AND media_encrypted_url IS NULL;
