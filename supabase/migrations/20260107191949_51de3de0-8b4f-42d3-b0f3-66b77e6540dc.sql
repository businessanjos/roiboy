-- Add transcription column to zapp_messages for storing audio transcriptions
ALTER TABLE public.zapp_messages 
ADD COLUMN IF NOT EXISTS transcription TEXT DEFAULT NULL;