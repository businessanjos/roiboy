-- 1) Papel efetivo do usuário dentro do WhatsApp de um setor
CREATE OR REPLACE FUNCTION public.zapp_sector_role(_auth_user_id uuid, _sector_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _auth_user_id IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = _auth_user_id
        AND (u.role IN ('admin','super_admin') OR u.is_also_admin = true)
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.super_admins sa
      JOIN public.users u ON u.id = sa.user_id
      WHERE u.auth_user_id = _auth_user_id
    ) THEN 'admin'
    WHEN _sector_id IS NULL THEN 'member'
    ELSE COALESCE((
      SELECT NULLIF(usa.role_in_sector, '')
      FROM public.user_sector_access usa
      JOIN public.users u ON u.id = usa.user_id
      WHERE u.auth_user_id = _auth_user_id
        AND usa.sector_id = _sector_id
        AND usa.is_active = true
      LIMIT 1
    ), 'member')
  END;
$$;

-- Pode escrever (responder, mudar status, taguear) neste setor?
CREATE OR REPLACE FUNCTION public.zapp_can_write_sector(_auth_user_id uuid, _sector_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.zapp_sector_role(_auth_user_id, _sector_id), 'viewer') <> 'viewer';
$$;

-- Pode transferir/reatribuir conversas deste setor? (Admin/Gestor)
CREATE OR REPLACE FUNCTION public.zapp_can_transfer_sector(_auth_user_id uuid, _sector_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.zapp_sector_role(_auth_user_id, _sector_id), '') IN ('admin','manager');
$$;

-- Pode escrever em pelo menos um setor (para tabelas sem sector_id)
CREATE OR REPLACE FUNCTION public.zapp_can_write_any(_auth_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _auth_user_id IS NOT NULL AND (
    public.zapp_sector_role(_auth_user_id, NULL) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.user_sector_access usa
      JOIN public.users u ON u.id = usa.user_id
      WHERE u.auth_user_id = _auth_user_id
        AND usa.is_active = true
        AND COALESCE(NULLIF(usa.role_in_sector,''), 'member') <> 'viewer'
    )
  );
$$;

-- Pode transferir em pelo menos um setor
CREATE OR REPLACE FUNCTION public.zapp_can_transfer_any(_auth_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _auth_user_id IS NOT NULL AND (
    public.zapp_sector_role(_auth_user_id, NULL) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.user_sector_access usa
      JOIN public.users u ON u.id = usa.user_id
      WHERE u.auth_user_id = _auth_user_id
        AND usa.is_active = true
        AND COALESCE(NULLIF(usa.role_in_sector,''), '') IN ('admin','manager')
    )
  );
$$;

-- Setor da conversa / do atendimento
CREATE OR REPLACE FUNCTION public.zapp_assignment_sector(_assignment_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.sector_id
  FROM public.zapp_conversation_assignments a
  LEFT JOIN public.zapp_conversations c ON c.id = a.zapp_conversation_id
  WHERE a.id = _assignment_id;
$$;

GRANT EXECUTE ON FUNCTION public.zapp_sector_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zapp_can_write_sector(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zapp_can_transfer_sector(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zapp_can_write_any(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zapp_can_transfer_any(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zapp_assignment_sector(uuid) TO authenticated, service_role;

-- 2) Viewer não envia mensagem
DROP POLICY IF EXISTS zapp_role_messages_insert ON public.zapp_messages;
CREATE POLICY zapp_role_messages_insert
ON public.zapp_messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  direction <> 'outbound'
  OR public.zapp_can_write_sector(
       auth.uid(),
       (SELECT c.sector_id FROM public.zapp_conversations c WHERE c.id = zapp_conversation_id)
     )
);

-- 3) Atribuição: viewer não altera nada; reatribuir para outro atendente exige Admin/Gestor
DROP POLICY IF EXISTS zapp_role_assignments_update ON public.zapp_conversation_assignments;
CREATE POLICY zapp_role_assignments_update
ON public.zapp_conversation_assignments AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.zapp_can_write_sector(auth.uid(), public.zapp_assignment_sector(id)))
WITH CHECK (
  public.zapp_can_write_sector(auth.uid(), public.zapp_assignment_sector(id))
  AND (
    agent_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.zapp_agents ag
      JOIN public.users u ON u.id = ag.user_id
      WHERE ag.id = agent_id AND u.auth_user_id = auth.uid()
    )
    OR public.zapp_can_transfer_sector(auth.uid(), public.zapp_assignment_sector(id))
  )
);

-- 4) Transferências registradas só por Admin/Gestor
DROP POLICY IF EXISTS zapp_role_transfers_insert ON public.zapp_transfers;
CREATE POLICY zapp_role_transfers_insert
ON public.zapp_transfers AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.zapp_can_transfer_any(auth.uid()));

-- 5) Tags: viewer não cria/edita/remove
DROP POLICY IF EXISTS zapp_role_tags_insert ON public.zapp_tags;
CREATE POLICY zapp_role_tags_insert
ON public.zapp_tags AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.zapp_can_write_any(auth.uid()));

DROP POLICY IF EXISTS zapp_role_tags_update ON public.zapp_tags;
CREATE POLICY zapp_role_tags_update
ON public.zapp_tags AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.zapp_can_write_any(auth.uid()))
WITH CHECK (public.zapp_can_write_any(auth.uid()));

DROP POLICY IF EXISTS zapp_role_tags_delete ON public.zapp_tags;
CREATE POLICY zapp_role_tags_delete
ON public.zapp_tags AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.zapp_can_write_any(auth.uid()));

DROP POLICY IF EXISTS zapp_role_conv_tags_insert ON public.zapp_conversation_tags;
CREATE POLICY zapp_role_conv_tags_insert
ON public.zapp_conversation_tags AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.zapp_can_write_sector(auth.uid(), public.zapp_assignment_sector(assignment_id)));

DROP POLICY IF EXISTS zapp_role_conv_tags_delete ON public.zapp_conversation_tags;
CREATE POLICY zapp_role_conv_tags_delete
ON public.zapp_conversation_tags AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.zapp_can_write_sector(auth.uid(), public.zapp_assignment_sector(assignment_id)));