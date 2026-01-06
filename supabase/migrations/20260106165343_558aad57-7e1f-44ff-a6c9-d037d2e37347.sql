-- Adicionar campos para finalização de conversa
ALTER TABLE zapp_conversation_assignments
ADD COLUMN IF NOT EXISTS close_summary TEXT,
ADD COLUMN IF NOT EXISTS close_ai_summary TEXT,
ADD COLUMN IF NOT EXISTS close_outcome VARCHAR(50),
ADD COLUMN IF NOT EXISTS close_notes TEXT,
ADD COLUMN IF NOT EXISTS service_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS first_message_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_client_message_at TIMESTAMP WITH TIME ZONE;