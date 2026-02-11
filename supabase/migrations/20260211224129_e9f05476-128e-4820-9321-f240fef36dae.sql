-- Make message_id nullable to support job types that don't have a message
ALTER TABLE public.ai_analysis_queue ALTER COLUMN message_id DROP NOT NULL;

-- Drop the unique constraint on message_id to allow multiple jobs per message
-- (client_analysis may create a sub-job of ai_analysis for the same message)
ALTER TABLE public.ai_analysis_queue DROP CONSTRAINT IF EXISTS ai_analysis_queue_message_id_key;