-- Enable full replica identity for realtime updates on zapp_messages
ALTER TABLE public.zapp_messages REPLICA IDENTITY FULL;

-- Add table to realtime publication if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'zapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.zapp_messages;
  END IF;
END$$;