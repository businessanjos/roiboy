-- Add columns to store encrypted media metadata for lazy download
ALTER TABLE public.zapp_messages 
ADD COLUMN IF NOT EXISTS media_encrypted_url TEXT,
ADD COLUMN IF NOT EXISTS media_key TEXT,
ADD COLUMN IF NOT EXISTS media_download_status TEXT DEFAULT 'pending';

-- Add index for messages pending media download
CREATE INDEX IF NOT EXISTS idx_zapp_messages_media_pending 
ON public.zapp_messages (media_download_status) 
WHERE media_type IS NOT NULL AND media_download_status = 'pending';

COMMENT ON COLUMN public.zapp_messages.media_encrypted_url IS 'Original encrypted WhatsApp media URL';
COMMENT ON COLUMN public.zapp_messages.media_key IS 'Base64 mediaKey for decryption';
COMMENT ON COLUMN public.zapp_messages.media_download_status IS 'pending, downloading, completed, failed';