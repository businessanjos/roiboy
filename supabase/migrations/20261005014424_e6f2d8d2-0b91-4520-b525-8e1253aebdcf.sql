CREATE OR REPLACE FUNCTION public.audit_unified_page(
  p_account_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_scope text DEFAULT 'system',
  p_action text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_user text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id text, source text, user_id text, user_name text, user_email text, action text,
  entity_type text, entity_id text, entity_name text, details jsonb, ip_address text,
  user_agent text, created_at timestamptz, context text, description text, total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_is_commercial boolean := (p_scope = 'commercial');
  v_deal_types text[] := ARRAY['stage_change', 'status_change', 'note', 'image'];
BEGIN
  RETURN QUERY
  WITH sales_users AS (
    SELECT DISTINCT utr.user_id
    FROM public.user_team_roles utr
    JOIN public.team_roles tr ON tr.id = utr.team_role_id
    WHERE tr.area = 'Comercial'
  ),
  base AS (
    SELECT 'audit-' || al.id::text AS id, 'audit'::text AS source, al.user_id::text AS user_id,
      COALESCE(al.user_name, u_al.name) AS user_name,
      COALESCE(al.user_email, u_al.email) AS user_email,
      al.action, al.entity_type, al.entity_id::text AS entity_id,
      al.entity_name, al.details, al.ip_address, al.user_agent, al.created_at,
      CASE
        WHEN al.entity_type = 'task' THEN COALESCE(
          'Lead ' || lead_t.full_name,
          'Negócio ' || deal_t.title,
          'Cliente ' || client_t.full_name
        )
        ELSE NULL
      END AS context
    FROM public.audit_logs al
    LEFT JOIN public.users u_al ON u_al.id = al.user_id
    LEFT JOIN public.internal_tasks it ON al.entity_type = 'task' AND it.id = al.entity_id
    LEFT JOIN public.leads lead_t ON lead_t.id = it.lead_id
    LEFT JOIN public.deals deal_t ON deal_t.id = it.deal_id
    LEFT JOIN public.clients client_t ON client_t.id = it.client_id
    WHERE (p_account_id IS NULL OR al.account_id = p_account_id)
      AND (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to IS NULL OR al.created_at <= p_to)
      AND al.action <> 'auto_heal_inactive'
      AND al.entity_type <> 'hr_collaborators'
      AND (NOT v_is_commercial OR al.entity_type = 'task')
      AND (NOT v_is_commercial OR al.user_id IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR al.action = p_action)
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR al.entity_type = p_entity_type)

    UNION ALL

    SELECT 'deal-activity-' || da.id::text, 'deal'::text, da.user_id::text,
      u_da.name AS user_name, u_da.email AS user_email,
      da.type, 'deal'::text, da.deal_id::text, d.title,
      jsonb_build_object('titulo', da.title, 'conteudo', da.content, 'de', da.old_value, 'para', da.new_value),
      NULL::text, NULL::text, da.created_at,
      COALESCE('Lead ' || lead_d.full_name, 'Cliente ' || client_d.full_name) AS context
    FROM public.deal_activities da
    LEFT JOIN public.deals d ON d.id = da.deal_id
    LEFT JOIN public.users u_da ON u_da.id = da.user_id
    LEFT JOIN public.leads lead_d ON lead_d.id = d.lead_id
    LEFT JOIN public.clients client_d ON client_d.id = d.client_id
    WHERE da.user_id IS NOT NULL
      AND da.type = ANY (v_deal_types)
      AND (p_account_id IS NULL OR da.account_id = p_account_id)
      AND (p_from IS NULL OR da.created_at >= p_from)
      AND (p_to IS NULL OR da.created_at <= p_to)
      AND (NOT v_is_commercial OR da.user_id IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR da.type = p_action)
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')

    UNION ALL

    SELECT 'deal-deleted-' || d.id::text, 'deal'::text, COALESCE(u_del.id::text, d.deleted_by::text),
      u_del.name AS user_name, u_del.email AS user_email,
      'delete'::text, 'deal'::text, d.id::text, d.title, NULL::jsonb, NULL::text, NULL::text, d.deleted_at,
      COALESCE('Lead ' || lead_del.full_name, 'Cliente ' || client_del.full_name) AS context
    FROM public.deals d
    LEFT JOIN public.users u_del ON u_del.auth_user_id = d.deleted_by AND u_del.account_id = d.account_id
    LEFT JOIN public.leads lead_del ON lead_del.id = d.lead_id
    LEFT JOIN public.clients client_del ON client_del.id = d.client_id
    WHERE d.deleted_at IS NOT NULL AND d.deleted_by IS NOT NULL
      AND (p_account_id IS NULL OR d.account_id = p_account_id)
      AND (p_from IS NULL OR d.deleted_at >= p_from)
      AND (p_to IS NULL OR d.deleted_at <= p_to)
      AND (NOT v_is_commercial OR u_del.id IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR p_action = 'delete')
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')

    UNION ALL

    SELECT 'deal-created-' || d.id::text, 'deal'::text, d.created_by::text,
      u_cre.name AS user_name, u_cre.email AS user_email,
      'create'::text, 'deal'::text, d.id::text, d.title, NULL::jsonb, NULL::text, NULL::text, d.created_at,
      COALESCE('Lead ' || lead_cre.full_name, 'Cliente ' || client_cre.full_name) AS context
    FROM public.deals d
    LEFT JOIN public.users u_cre ON u_cre.id = d.created_by
    LEFT JOIN public.leads lead_cre ON lead_cre.id = d.lead_id
    LEFT JOIN public.clients client_cre ON client_cre.id = d.client_id
    WHERE d.created_by IS NOT NULL
      AND (p_account_id IS NULL OR d.account_id = p_account_id)
      AND (p_from IS NULL OR d.created_at >= p_from)
      AND (p_to IS NULL OR d.created_at <= p_to)
      AND (NOT v_is_commercial OR d.created_by IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR p_action = 'create')
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')
  ),
  augmented AS (
    SELECT b.*,
      CASE
        WHEN b.entity_type = 'deal' AND b.action = 'stage_change'
             AND (b.details->>'de' IS NOT NULL OR b.details->>'para' IS NOT NULL) THEN
          'Moveu o negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
            || ' de "' || COALESCE(b.details->>'de', '?') || '" para "' || COALESCE(b.details->>'para', '?') || '"'
        WHEN b.entity_type = 'deal' AND b.action = 'status_change' AND b.details->>'para' IS NOT NULL THEN
          'Marcou o negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
            || ' como "' || (b.details->>'para') || '"'
        WHEN b.entity_type = 'deal' AND b.action = 'note' THEN
          'Registrou uma nota no negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
        WHEN b.entity_type = 'deal' AND b.action = 'image' THEN
          'Anexou um arquivo no negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
        WHEN b.entity_type = 'deal' AND b.action = 'delete' THEN
          'Excluiu o negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
        WHEN b.entity_type = 'deal' AND b.action = 'create' THEN
          'Criou o negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
        ELSE
          CASE b.action
            WHEN 'create' THEN 'Criou'
            WHEN 'update' THEN 'Atualizou'
            WHEN 'delete' THEN 'Excluiu'
            WHEN 'login' THEN 'Login'
            WHEN 'logout' THEN 'Logout'
            WHEN 'view' THEN 'Visualizou'
            WHEN 'export' THEN 'Exportou'
            WHEN 'import' THEN 'Importou'
            WHEN 'assign' THEN 'Atribuiu'
            WHEN 'complete' THEN 'Completou'
            WHEN 'archive' THEN 'Arquivou'
            WHEN 'stage_change' THEN 'Mudou etapa'
            WHEN 'status_change' THEN 'Mudou status'
            WHEN 'note' THEN 'Registrou nota'
            WHEN 'image' THEN 'Anexou arquivo'
            WHEN 'user.deactivated' THEN 'Desativou usuário'
            WHEN 'user.activated' THEN 'Reativou usuário'
            WHEN 'user.access_profile_changed' THEN 'Alterou permissões'
            WHEN 'user.created' THEN 'Criou usuário'
            ELSE b.action
          END
          || ' ' ||
          lower(CASE b.entity_type
            WHEN 'client' THEN 'Cliente'
            WHEN 'user' THEN 'Usuário'
            WHEN 'event' THEN 'Evento'
            WHEN 'task' THEN 'Tarefa'
            WHEN 'contract' THEN 'Contrato'
            WHEN 'product' THEN 'Produto'
            WHEN 'form' THEN 'Formulário'
            WHEN 'followup' THEN 'Followup'
            WHEN 'subscription' THEN 'Assinatura'
            WHEN 'settings' THEN 'Configurações'
            WHEN 'integration' THEN 'Integração'
            WHEN 'role' THEN 'Cargo'
            WHEN 'permission' THEN 'Permissão'
            WHEN 'deal' THEN 'Negócio'
            ELSE b.entity_type
          END)
          || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
          || CASE WHEN b.context IS NOT NULL THEN ' — ' || b.context ELSE '' END
      END AS description
    FROM base b
  ),
  filtered AS (
    SELECT a.* FROM augmented a
    WHERE (p_user IS NULL OR p_user = 'all' OR a.user_id = p_user)
      AND (
        p_search IS NULL OR p_search = '' OR
        a.user_name ILIKE '%' || p_search || '%' OR
        a.user_email ILIKE '%' || p_search || '%' OR
        a.entity_name ILIKE '%' || p_search || '%' OR
        a.entity_type ILIKE '%' || p_search || '%' OR
        a.action ILIKE '%' || p_search || '%' OR
        a.context ILIKE '%' || p_search || '%' OR
        a.description ILIKE '%' || p_search || '%' OR
        a.details::text ILIKE '%' || p_search || '%'
      )
  )
  SELECT f.id, f.source, f.user_id, f.user_name, f.user_email, f.action, f.entity_type,
         f.entity_id, f.entity_name, f.details, f.ip_address, f.user_agent, f.created_at,
         f.context, f.description,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC, f.source, f.id
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_unified_page(
  uuid, timestamptz, timestamptz, text, text, text, text, text, integer, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_unified_page(
  uuid, timestamptz, timestamptz, text, text, text, text, text, integer, integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_unified_authors(
  p_account_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_scope text DEFAULT 'system',
  p_action text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  user_id text, user_name text, user_email text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_is_commercial boolean := (p_scope = 'commercial');
  v_deal_types text[] := ARRAY['stage_change', 'status_change', 'note', 'image'];
BEGIN
  RETURN QUERY
  WITH sales_users AS (
    SELECT DISTINCT utr.user_id
    FROM public.user_team_roles utr
    JOIN public.team_roles tr ON tr.id = utr.team_role_id
    WHERE tr.area = 'Comercial'
  ),
  base AS (
    SELECT al.user_id::text AS user_id,
      COALESCE(al.user_name, u_al.name) AS user_name,
      COALESCE(al.user_email, u_al.email) AS user_email,
      al.action, al.entity_type, al.entity_name, al.details,
      CASE
        WHEN al.entity_type = 'task' THEN COALESCE(
          'Lead ' || lead_t.full_name,
          'Negócio ' || deal_t.title,
          'Cliente ' || client_t.full_name
        )
        ELSE NULL
      END AS context
    FROM public.audit_logs al
    LEFT JOIN public.users u_al ON u_al.id = al.user_id
    LEFT JOIN public.internal_tasks it ON al.entity_type = 'task' AND it.id = al.entity_id
    LEFT JOIN public.leads lead_t ON lead_t.id = it.lead_id
    LEFT JOIN public.deals deal_t ON deal_t.id = it.deal_id
    LEFT JOIN public.clients client_t ON client_t.id = it.client_id
    WHERE al.user_id IS NOT NULL
      AND (p_account_id IS NULL OR al.account_id = p_account_id)
      AND (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to IS NULL OR al.created_at <= p_to)
      AND al.action <> 'auto_heal_inactive'
      AND al.entity_type <> 'hr_collaborators'
      AND (NOT v_is_commercial OR al.entity_type = 'task')
      AND (NOT v_is_commercial OR al.user_id IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR al.action = p_action)
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR al.entity_type = p_entity_type)

    UNION ALL

    SELECT da.user_id::text, u_da.name, u_da.email, da.type, 'deal'::text, d.title,
      jsonb_build_object('titulo', da.title, 'conteudo', da.content, 'de', da.old_value, 'para', da.new_value),
      COALESCE('Lead ' || lead_d.full_name, 'Cliente ' || client_d.full_name)
    FROM public.deal_activities da
    LEFT JOIN public.deals d ON d.id = da.deal_id
    LEFT JOIN public.users u_da ON u_da.id = da.user_id
    LEFT JOIN public.leads lead_d ON lead_d.id = d.lead_id
    LEFT JOIN public.clients client_d ON client_d.id = d.client_id
    WHERE da.user_id IS NOT NULL
      AND da.type = ANY (v_deal_types)
      AND (p_account_id IS NULL OR da.account_id = p_account_id)
      AND (p_from IS NULL OR da.created_at >= p_from)
      AND (p_to IS NULL OR da.created_at <= p_to)
      AND (NOT v_is_commercial OR da.user_id IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR da.type = p_action)
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')

    UNION ALL

    SELECT COALESCE(u_del.id::text, d.deleted_by::text), u_del.name, u_del.email, 'delete'::text, 'deal'::text, d.title, NULL::jsonb,
      COALESCE('Lead ' || lead_del.full_name, 'Cliente ' || client_del.full_name)
    FROM public.deals d
    LEFT JOIN public.users u_del ON u_del.auth_user_id = d.deleted_by AND u_del.account_id = d.account_id
    LEFT JOIN public.leads lead_del ON lead_del.id = d.lead_id
    LEFT JOIN public.clients client_del ON client_del.id = d.client_id
    WHERE d.deleted_at IS NOT NULL AND d.deleted_by IS NOT NULL
      AND (p_account_id IS NULL OR d.account_id = p_account_id)
      AND (p_from IS NULL OR d.deleted_at >= p_from)
      AND (p_to IS NULL OR d.deleted_at <= p_to)
      AND (NOT v_is_commercial OR u_del.id IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR p_action = 'delete')
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')

    UNION ALL

    SELECT d.created_by::text, u_cre.name, u_cre.email, 'create'::text, 'deal'::text, d.title, NULL::jsonb,
      COALESCE('Lead ' || lead_cre.full_name, 'Cliente ' || client_cre.full_name)
    FROM public.deals d
    LEFT JOIN public.users u_cre ON u_cre.id = d.created_by
    LEFT JOIN public.leads lead_cre ON lead_cre.id = d.lead_id
    LEFT JOIN public.clients client_cre ON client_cre.id = d.client_id
    WHERE d.created_by IS NOT NULL
      AND (p_account_id IS NULL OR d.account_id = p_account_id)
      AND (p_from IS NULL OR d.created_at >= p_from)
      AND (p_to IS NULL OR d.created_at <= p_to)
      AND (NOT v_is_commercial OR d.created_by IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR p_action = 'create')
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')
  ),
  augmented AS (
    SELECT b.*,
      CASE
        WHEN b.entity_type = 'deal' AND b.action = 'stage_change'
             AND (b.details->>'de' IS NOT NULL OR b.details->>'para' IS NOT NULL) THEN
          'Moveu o negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
            || ' de "' || COALESCE(b.details->>'de', '?') || '" para "' || COALESCE(b.details->>'para', '?') || '"'
        WHEN b.entity_type = 'deal' AND b.action = 'status_change' AND b.details->>'para' IS NOT NULL THEN
          'Marcou o negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
            || ' como "' || (b.details->>'para') || '"'
        WHEN b.entity_type = 'deal' AND b.action = 'note' THEN
          'Registrou uma nota no negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
        WHEN b.entity_type = 'deal' AND b.action = 'image' THEN
          'Anexou um arquivo no negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
        WHEN b.entity_type = 'deal' AND b.action = 'delete' THEN
          'Excluiu o negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
        WHEN b.entity_type = 'deal' AND b.action = 'create' THEN
          'Criou o negócio' || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
        ELSE
          CASE b.action
            WHEN 'create' THEN 'Criou'
            WHEN 'update' THEN 'Atualizou'
            WHEN 'delete' THEN 'Excluiu'
            WHEN 'login' THEN 'Login'
            WHEN 'logout' THEN 'Logout'
            WHEN 'view' THEN 'Visualizou'
            WHEN 'export' THEN 'Exportou'
            WHEN 'import' THEN 'Importou'
            WHEN 'assign' THEN 'Atribuiu'
            WHEN 'complete' THEN 'Completou'
            WHEN 'archive' THEN 'Arquivou'
            WHEN 'stage_change' THEN 'Mudou etapa'
            WHEN 'status_change' THEN 'Mudou status'
            WHEN 'note' THEN 'Registrou nota'
            WHEN 'image' THEN 'Anexou arquivo'
            WHEN 'user.deactivated' THEN 'Desativou usuário'
            WHEN 'user.activated' THEN 'Reativou usuário'
            WHEN 'user.access_profile_changed' THEN 'Alterou permissões'
            WHEN 'user.created' THEN 'Criou usuário'
            ELSE b.action
          END
          || ' ' ||
          lower(CASE b.entity_type
            WHEN 'client' THEN 'Cliente'
            WHEN 'user' THEN 'Usuário'
            WHEN 'event' THEN 'Evento'
            WHEN 'task' THEN 'Tarefa'
            WHEN 'contract' THEN 'Contrato'
            WHEN 'product' THEN 'Produto'
            WHEN 'form' THEN 'Formulário'
            WHEN 'followup' THEN 'Followup'
            WHEN 'subscription' THEN 'Assinatura'
            WHEN 'settings' THEN 'Configurações'
            WHEN 'integration' THEN 'Integração'
            WHEN 'role' THEN 'Cargo'
            WHEN 'permission' THEN 'Permissão'
            WHEN 'deal' THEN 'Negócio'
            ELSE b.entity_type
          END)
          || CASE WHEN b.entity_name IS NOT NULL THEN ' "' || b.entity_name || '"' ELSE '' END
          || CASE WHEN b.context IS NOT NULL THEN ' — ' || b.context ELSE '' END
      END AS description
    FROM base b
  )
  SELECT DISTINCT a.user_id, a.user_name, a.user_email
  FROM augmented a
  WHERE a.user_id IS NOT NULL
    AND (
      p_search IS NULL OR p_search = '' OR
      a.user_name ILIKE '%' || p_search || '%' OR
      a.user_email ILIKE '%' || p_search || '%' OR
      a.entity_name ILIKE '%' || p_search || '%' OR
      a.entity_type ILIKE '%' || p_search || '%' OR
      a.action ILIKE '%' || p_search || '%' OR
      a.context ILIKE '%' || p_search || '%' OR
      a.description ILIKE '%' || p_search || '%' OR
      a.details::text ILIKE '%' || p_search || '%'
    )
  ORDER BY a.user_name NULLS LAST, a.user_email NULLS LAST;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_unified_authors(
  uuid, timestamptz, timestamptz, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_unified_authors(
  uuid, timestamptz, timestamptz, text, text, text, text
) TO authenticated;