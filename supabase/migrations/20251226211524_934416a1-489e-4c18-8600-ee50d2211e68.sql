-- Create AI analysis queue table for async processing
CREATE TABLE public.ai_analysis_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.zapp_messages(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(message_id)
);

-- Enable RLS
ALTER TABLE public.ai_analysis_queue ENABLE ROW LEVEL SECURITY;

-- RLS policy - only account members can view their queue
CREATE POLICY "Users can view their account queue"
  ON public.ai_analysis_queue
  FOR SELECT
  USING (account_id = get_user_account_id());

-- Index for efficient queue processing
CREATE INDEX idx_ai_queue_pending ON public.ai_analysis_queue (status, priority DESC, created_at ASC) 
  WHERE status = 'pending';

-- Index for account lookups
CREATE INDEX idx_ai_queue_account ON public.ai_analysis_queue (account_id, status);

-- Index for cleanup of old completed jobs
CREATE INDEX idx_ai_queue_completed ON public.ai_analysis_queue (completed_at) 
  WHERE status IN ('completed', 'failed');

-- Add indexes to zapp_messages for better query performance
CREATE INDEX IF NOT EXISTS idx_zapp_messages_conversation ON public.zapp_messages (zapp_conversation_id, created_at DESC);

-- Add indexes to zapp_conversations for better query performance  
CREATE INDEX IF NOT EXISTS idx_zapp_conversations_account ON public.zapp_conversations (account_id, updated_at DESC);

-- Add index for client phone lookup
CREATE INDEX IF NOT EXISTS idx_clients_phone_account ON public.clients (account_id, phone_e164);