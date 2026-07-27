DROP POLICY IF EXISTS "Users can insert zapp_messages to their account" ON public.zapp_messages;
DROP POLICY IF EXISTS "zapp_role_messages_insert" ON public.zapp_messages;

CREATE POLICY "zapp_messages_insert_sector"
ON public.zapp_messages FOR INSERT TO authenticated
WITH CHECK (
  account_id = get_user_account_id()
  AND EXISTS (
    SELECT 1 FROM public.zapp_conversations c
    WHERE c.id = zapp_messages.zapp_conversation_id
      AND public.user_can_access_zapp_sector(c.sector_id)
      AND (
        zapp_messages.direction <> 'outbound'
        OR public.zapp_can_write_sector(auth.uid(), c.sector_id)
      )
  )
);

DROP POLICY IF EXISTS "Users can insert zapp_conversations to their account" ON public.zapp_conversations;
CREATE POLICY "zapp_conversations_insert_sector"
ON public.zapp_conversations FOR INSERT TO authenticated
WITH CHECK (
  account_id = get_user_account_id()
  AND public.user_can_access_zapp_sector(sector_id)
);