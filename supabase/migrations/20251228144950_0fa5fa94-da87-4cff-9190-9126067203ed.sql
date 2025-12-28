-- Add media columns to internal_messages table
ALTER TABLE public.internal_messages 
  ALTER COLUMN content DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size integer,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS audio_duration integer;

-- Add comment for message_type
COMMENT ON COLUMN public.internal_messages.message_type IS 'Type of message: text, audio, file, image';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_internal_messages_message_type ON public.internal_messages(message_type);