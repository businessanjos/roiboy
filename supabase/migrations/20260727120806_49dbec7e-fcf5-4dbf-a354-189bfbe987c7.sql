-- Regra central de acesso a WhatsApp por setor dentro do ROY zAPP
CREATE OR REPLACE FUNCTION public.user_can_access_zapp_sector(_sector_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT u.id, u.role, u.is_also_admin, u.email
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  ),
  unrestricted AS (
    SELECT EXISTS (
      SELECT 1 FROM me
      WHERE me.role IN ('admin','super_admin')
         OR me.is_also_admin = true
         OR lower(coalesce(me.email,'')) IN ('m.quintana@me.com','coachevertonsantos@gmail.com')
    ) AS ok
  ),
  zapp AS (
    SELECT v.zapp_sectors
    FROM public.user_royzapp_views v
    JOIN me ON me.id = v.user_id
    LIMIT 1
  )
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM me) THEN false
      WHEN (SELECT ok FROM unrestricted) THEN true
      WHEN _sector_id IS NULL THEN true
      WHEN EXISTS (SELECT 1 FROM zapp WHERE zapp_sectors IS NOT NULL)
        THEN _sector_id = ANY (SELECT unnest(zapp_sectors) FROM zapp)
      ELSE EXISTS (
        SELECT 1 FROM public.user_sector_access usa
        JOIN me ON me.id = usa.user_id
        WHERE usa.sector_id = _sector_id AND usa.is_active = true
      )
    END;
$$;

-- Conversas: restringe por setor além da conta
DROP POLICY IF EXISTS "Users can view zapp_conversations from their account" ON public.zapp_conversations;
DROP POLICY IF EXISTS "Users can update zapp_conversations in their account" ON public.zapp_conversations;
DROP POLICY IF EXISTS "Users can delete zapp_conversations in their account" ON public.zapp_conversations;

CREATE POLICY "zapp_conversations_select_sector"
ON public.zapp_conversations FOR SELECT TO authenticated
USING (account_id = get_user_account_id() AND public.user_can_access_zapp_sector(sector_id));

CREATE POLICY "zapp_conversations_update_sector"
ON public.zapp_conversations FOR UPDATE TO authenticated
USING (account_id = get_user_account_id() AND public.user_can_access_zapp_sector(sector_id))
WITH CHECK (account_id = get_user_account_id() AND public.user_can_access_zapp_sector(sector_id));

CREATE POLICY "zapp_conversations_delete_sector"
ON public.zapp_conversations FOR DELETE TO authenticated
USING (account_id = get_user_account_id() AND public.user_can_access_zapp_sector(sector_id));

-- Mensagens: herdam a permissão da conversa
DROP POLICY IF EXISTS "Users can view zapp_messages from their account" ON public.zapp_messages;
DROP POLICY IF EXISTS "Users can update zapp_messages in their account" ON public.zapp_messages;
DROP POLICY IF EXISTS "Users can delete zapp_messages in their account" ON public.zapp_messages;

CREATE POLICY "zapp_messages_select_sector"
ON public.zapp_messages FOR SELECT TO authenticated
USING (
  account_id = get_user_account_id()
  AND EXISTS (
    SELECT 1 FROM public.zapp_conversations c
    WHERE c.id = zapp_messages.zapp_conversation_id
      AND public.user_can_access_zapp_sector(c.sector_id)
  )
);

CREATE POLICY "zapp_messages_update_sector"
ON public.zapp_messages FOR UPDATE TO authenticated
USING (
  account_id = get_user_account_id()
  AND EXISTS (
    SELECT 1 FROM public.zapp_conversations c
    WHERE c.id = zapp_messages.zapp_conversation_id
      AND public.user_can_access_zapp_sector(c.sector_id)
  )
)
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "zapp_messages_delete_sector"
ON public.zapp_messages FOR DELETE TO authenticated
USING (
  account_id = get_user_account_id()
  AND EXISTS (
    SELECT 1 FROM public.zapp_conversations c
    WHERE c.id = zapp_messages.zapp_conversation_id
      AND public.user_can_access_zapp_sector(c.sector_id)
  )
);

GRANT EXECUTE ON FUNCTION public.user_can_access_zapp_sector(text) TO authenticated;