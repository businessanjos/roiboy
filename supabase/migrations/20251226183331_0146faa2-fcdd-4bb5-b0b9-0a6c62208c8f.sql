-- Enable REPLICA IDENTITY FULL for realtime tables
ALTER TABLE public.zapp_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.zapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.zapp_conversation_assignments REPLICA IDENTITY FULL;

-- Add zapp_conversation_assignments to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.zapp_conversation_assignments;