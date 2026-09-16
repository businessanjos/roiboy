CREATE TABLE public.zapp_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  zapp_conversation_id uuid REFERENCES public.zapp_conversations(id) ON DELETE CASCADE,
  zapp_message_id uuid REFERENCES public.zapp_messages(id) ON DELETE CASCADE,
  external_message_id text,
  emoji text NOT NULL,
  reactor_phone text,
  reactor_name text,
  reactor_user_id uuid,
  from_me boolean NOT NULL DEFAULT false,
  reacted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_zapp_message_reactions_msg_reactor
  ON public.zapp_message_reactions (zapp_message_id, coalesce(reactor_phone, ''))
  WHERE zapp_message_id IS NOT NULL;

CREATE UNIQUE INDEX uq_zapp_message_reactions_ext_reactor
  ON public.zapp_message_reactions (account_id, external_message_id, coalesce(reactor_phone, ''))
  WHERE zapp_message_id IS NULL AND external_message_id IS NOT NULL;

CREATE INDEX idx_zapp_message_reactions_conversation ON public.zapp_message_reactions (zapp_conversation_id);
CREATE INDEX idx_zapp_message_reactions_message ON public.zapp_message_reactions (zapp_message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapp_message_reactions TO authenticated;
GRANT ALL ON public.zapp_message_reactions TO service_role;

ALTER TABLE public.zapp_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY zapp_message_reactions_select_sector ON public.zapp_message_reactions
FOR SELECT TO authenticated
USING (account_id = get_user_account_id() AND EXISTS (
  SELECT 1 FROM public.zapp_conversations c
  WHERE c.id = zapp_message_reactions.zapp_conversation_id AND user_can_access_zapp_sector(c.sector_id)
));

CREATE POLICY zapp_message_reactions_insert_sector ON public.zapp_message_reactions
FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id() AND EXISTS (
  SELECT 1 FROM public.zapp_conversations c
  WHERE c.id = zapp_message_reactions.zapp_conversation_id AND user_can_access_zapp_sector(c.sector_id)
));

CREATE POLICY zapp_message_reactions_update_sector ON public.zapp_message_reactions
FOR UPDATE TO authenticated
USING (account_id = get_user_account_id() AND EXISTS (
  SELECT 1 FROM public.zapp_conversations c
  WHERE c.id = zapp_message_reactions.zapp_conversation_id AND user_can_access_zapp_sector(c.sector_id)
))
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY zapp_message_reactions_delete_sector ON public.zapp_message_reactions
FOR DELETE TO authenticated
USING (account_id = get_user_account_id() AND EXISTS (
  SELECT 1 FROM public.zapp_conversations c
  WHERE c.id = zapp_message_reactions.zapp_conversation_id AND user_can_access_zapp_sector(c.sector_id)
));

ALTER TABLE public.zapp_message_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.zapp_message_reactions;