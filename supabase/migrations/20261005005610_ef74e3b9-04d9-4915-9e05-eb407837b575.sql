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
  user_agent text, created_at timestamptz, total_count bigint
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
      al.user_name, al.user_email, al.action, al.entity_type, al.entity_id::text AS entity_id,
      al.entity_name, al.details, al.ip_address, al.user_agent, al.created_at
    FROM public.audit_logs al
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
    SELECT 'deal-activity-' || da.id::text, 'deal'::text, da.user_id::text, NULL::text, NULL::text,
      da.type, 'deal'::text, da.deal_id::text, d.title,
      jsonb_build_object('titulo', da.title, 'conteudo', da.content, 'de', da.old_value, 'para', da.new_value),
      NULL::text, NULL::text, da.created_at
    FROM public.deal_activities da
    JOIN public.deals d ON d.id = da.deal_id
    WHERE da.user_id IS NOT NULL
      AND da.type = ANY (v_deal_types)
      AND (p_account_id IS NULL OR da.account_id = p_account_id)
      AND (p_from IS NULL OR da.created_at >= p_from)
      AND (p_to IS NULL OR da.created_at <= p_to)
      AND (NOT v_is_commercial OR da.user_id IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR da.type = p_action)
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')
    UNION ALL
    SELECT 'deal-deleted-' || d.id::text, 'deal'::text, d.deleted_by::text, NULL::text, NULL::text,
      'delete'::text, 'deal'::text, d.id::text, d.title, NULL::jsonb, NULL::text, NULL::text, d.deleted_at
    FROM public.deals d
    WHERE d.deleted_at IS NOT NULL AND d.deleted_by IS NOT NULL
      AND (p_account_id IS NULL OR d.account_id = p_account_id)
      AND (p_from IS NULL OR d.deleted_at >= p_from)
      AND (p_to IS NULL OR d.deleted_at <= p_to)
      AND (NOT v_is_commercial OR d.deleted_by IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR p_action = 'delete')
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')
    UNION ALL
    SELECT 'deal-created-' || d.id::text, 'deal'::text, d.created_by::text, NULL::text, NULL::text,
      'create'::text, 'deal'::text, d.id::text, d.title, NULL::jsonb, NULL::text, NULL::text, d.created_at
    FROM public.deals d
    WHERE d.created_by IS NOT NULL
      AND (p_account_id IS NULL OR d.account_id = p_account_id)
      AND (p_from IS NULL OR d.created_at >= p_from)
      AND (p_to IS NULL OR d.created_at <= p_to)
      AND (NOT v_is_commercial OR d.created_by IN (SELECT su.user_id FROM sales_users su))
      AND (p_action IS NULL OR p_action = 'all' OR p_action = 'create')
      AND (v_is_commercial OR p_entity_type IS NULL OR p_entity_type = 'all' OR p_entity_type = 'deal')
  ),
  filtered AS (
    SELECT b.* FROM base b
    WHERE (p_user IS NULL OR p_user = 'all' OR b.user_id = p_user)
      AND (
        p_search IS NULL OR p_search = '' OR
        b.user_name ILIKE '%' || p_search || '%' OR
        b.user_email ILIKE '%' || p_search || '%' OR
        b.entity_name ILIKE '%' || p_search || '%' OR
        b.entity_type ILIKE '%' || p_search || '%' OR
        b.action ILIKE '%' || p_search || '%' OR
        b.details::text ILIKE '%' || p_search || '%'
      )
  )
  SELECT f.id, f.source, f.user_id, f.user_name, f.user_email, f.action, f.entity_type,
         f.entity_id, f.entity_name, f.details, f.ip_address, f.user_agent, f.created_at,
         count(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC, f.source, f.id
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_unified_page(
  uuid, timestamptz, timestamptz, text, text, text, text, text, integer, integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.zapp_attendance_metrics(p_account_id uuid, p_since timestamptz)
RETURNS TABLE (
  user_id uuid, name text, avatar_url text, conversations bigint, messages bigint,
  open_conversations bigint, avg_first_response_min numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH msg AS (
    SELECT m.sender_user_id AS uid, count(*) AS messages, count(DISTINCT m.zapp_conversation_id) AS conversations
    FROM zapp_messages m
    WHERE m.account_id = p_account_id AND m.direction = 'outbound'
      AND m.sender_user_id IS NOT NULL AND m.sent_at >= p_since
    GROUP BY m.sender_user_id
  ),
  open_a AS (
    SELECT za.user_id AS uid, count(*) AS open_conversations
    FROM zapp_conversation_assignments a JOIN zapp_agents za ON za.id = a.agent_id
    WHERE a.account_id = p_account_id AND a.status::text IN ('active', 'pending')
    GROUP BY za.user_id
  ),
  resp_a AS (
    SELECT za.user_id AS uid,
      avg(EXTRACT(EPOCH FROM (a.first_response_at - a.first_message_at)) / 60.0) AS avg_first_response_min
    FROM zapp_conversation_assignments a JOIN zapp_agents za ON za.id = a.agent_id
    WHERE a.account_id = p_account_id AND a.created_at >= p_since
      AND a.first_response_at IS NOT NULL AND a.first_message_at IS NOT NULL
      AND a.first_response_at >= a.first_message_at
    GROUP BY za.user_id
  ),
  uids AS (SELECT uid FROM msg UNION SELECT uid FROM open_a UNION SELECT uid FROM resp_a)
  SELECT u.uid, coalesce(usr.name, '—'), usr.avatar_url,
    coalesce(m.conversations, 0), coalesce(m.messages, 0), coalesce(o.open_conversations, 0),
    r.avg_first_response_min
  FROM uids u
  LEFT JOIN users usr ON usr.id = u.uid
  LEFT JOIN msg m ON m.uid = u.uid
  LEFT JOIN open_a o ON o.uid = u.uid
  LEFT JOIN resp_a r ON r.uid = u.uid
  WHERE u.uid IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.zapp_attendance_metrics(uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.zapp_attendance_daily(p_account_id uuid, p_since timestamptz)
RETURNS TABLE (day date, messages bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT date_trunc('day', m.sent_at)::date, count(*)
  FROM zapp_messages m
  WHERE m.account_id = p_account_id AND m.direction = 'outbound'
    AND m.sender_user_id IS NOT NULL AND m.sent_at >= p_since
  GROUP BY 1 ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.zapp_attendance_daily(uuid, timestamptz) TO authenticated;