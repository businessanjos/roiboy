CREATE TABLE public.zapp_conversation_reads (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  zapp_conversation_id uuid NOT NULL REFERENCES public.zapp_conversations(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, zapp_conversation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapp_conversation_reads TO authenticated;
GRANT ALL ON public.zapp_conversation_reads TO service_role;
ALTER TABLE public.zapp_conversation_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reads" ON public.zapp_conversation_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.zapp_my_group_unread(p_conv_ids uuid[])
RETURNS TABLE(conversation_id uuid, unread integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT r.zapp_conversation_id,
    (SELECT count(*)::int FROM (SELECT 1 FROM zapp_messages m
       WHERE m.zapp_conversation_id = r.zapp_conversation_id
         AND m.direction = 'inbound' AND m.created_at > r.last_read_at LIMIT 99) x)
  FROM zapp_conversation_reads r
  WHERE r.user_id = auth.uid() AND r.zapp_conversation_id = ANY(p_conv_ids);
$$;
GRANT EXECUTE ON FUNCTION public.zapp_my_group_unread(uuid[]) TO authenticated;