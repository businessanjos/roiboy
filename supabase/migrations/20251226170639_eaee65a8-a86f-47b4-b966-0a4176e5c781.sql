-- Create zapp_conversations table to store ALL WhatsApp conversations for Zapp
-- This is separate from 'conversations' which requires a client_id
CREATE TABLE public.zapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  phone_e164 TEXT NOT NULL,
  contact_name TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  external_thread_id TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, phone_e164)
);

-- Create index for faster queries
CREATE INDEX idx_zapp_conversations_account ON public.zapp_conversations(account_id);
CREATE INDEX idx_zapp_conversations_phone ON public.zapp_conversations(phone_e164);
CREATE INDEX idx_zapp_conversations_last_message ON public.zapp_conversations(last_message_at DESC);

-- Create zapp_messages table to store all messages for Zapp
CREATE TABLE public.zapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  zapp_conversation_id UUID NOT NULL REFERENCES public.zapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  message_type TEXT DEFAULT 'text',
  external_message_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster message queries
CREATE INDEX idx_zapp_messages_conversation ON public.zapp_messages(zapp_conversation_id);
CREATE INDEX idx_zapp_messages_sent_at ON public.zapp_messages(sent_at DESC);

-- Update zapp_conversation_assignments to reference zapp_conversations instead
-- First, add new column
ALTER TABLE public.zapp_conversation_assignments 
  ADD COLUMN zapp_conversation_id UUID REFERENCES public.zapp_conversations(id) ON DELETE CASCADE;

-- Make conversation_id nullable (for migration)
ALTER TABLE public.zapp_conversation_assignments 
  ALTER COLUMN conversation_id DROP NOT NULL;

-- Enable RLS
ALTER TABLE public.zapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for zapp_conversations
CREATE POLICY "Users can view zapp_conversations from their account"
  ON public.zapp_conversations FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert zapp_conversations to their account"
  ON public.zapp_conversations FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can update zapp_conversations in their account"
  ON public.zapp_conversations FOR UPDATE
  USING (account_id = public.get_user_account_id());

-- RLS policies for zapp_messages
CREATE POLICY "Users can view zapp_messages from their account"
  ON public.zapp_messages FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert zapp_messages to their account"
  ON public.zapp_messages FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

-- Enable realtime for zapp tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.zapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.zapp_messages;

-- Add trigger to update updated_at
CREATE TRIGGER update_zapp_conversations_updated_at
  BEFORE UPDATE ON public.zapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();