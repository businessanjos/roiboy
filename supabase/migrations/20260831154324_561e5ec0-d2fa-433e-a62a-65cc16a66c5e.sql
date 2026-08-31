CREATE OR REPLACE FUNCTION public.zapp_productivity_contacts(
  _sector_id text,
  _from timestamptz,
  _to timestamptz,
  _integration_id uuid DEFAULT NULL,
  _include_groups boolean DEFAULT false,
  _agent_user_id uuid DEFAULT NULL,
  _direction text DEFAULT 'outbound'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _account uuid;
  _result jsonb;
BEGIN
  IF NOT public.zapp_can_view_analytics() THEN
    RAISE EXCEPTION 'Sem permissão para acessar as métricas do ROY zAPP';
  END IF;

  SELECT account_id INTO _account FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF _account IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  WITH convs_raw AS (
    SELECT c.id, c.client_id, c.is_group, c.contact_name, c.phone_e164, c.created_at
    FROM public.zapp_conversations c
    WHERE c.account_id = _account
      AND (_sector_id IS NULL OR c.sector_id = _sector_id)
      AND (_integration_id IS NULL OR c.integration_id = _integration_id)
      AND (_include_groups OR coalesce(c.is_group, false) = false)
  ),
  convs AS (
    SELECT cr.* FROM convs_raw cr
    WHERE _agent_user_id IS NULL OR EXISTS (
      SELECT 1 FROM public.zapp_messages m2
      WHERE m2.zapp_conversation_id = cr.id
        AND m2.account_id = _account
        AND m2.sender_user_id = _agent_user_id
        AND coalesce(m2.is_deleted, false) = false
        AND m2.sent_at >= _from AND m2.sent_at < _to
    )
  ),
  dedup AS (
    SELECT DISTINCT ON (coalesce(m.external_message_id, m.id::text))
      m.id, m.zapp_conversation_id AS cid, m.direction, m.sent_at, m.sender_user_id
    FROM public.zapp_messages m
    JOIN convs c ON c.id = m.zapp_conversation_id
    WHERE m.account_id = _account
      AND coalesce(m.is_deleted, false) = false
      AND (_agent_user_id IS NULL OR m.direction = 'inbound' OR m.sender_user_id = _agent_user_id)
    ORDER BY coalesce(m.external_message_id, m.id::text), m.sent_at ASC, m.id ASC
  ),
  msgs AS (
    SELECT d.* FROM dedup d WHERE d.sent_at >= _from AND d.sent_at < _to
  ),
  scope AS (
    SELECT
      coalesce(c.client_id::text, c.phone_e164, c.id::text) AS contact_key,
      max(c.contact_name) AS contact_name,
      max(c.phone_e164) AS phone_e164,
      max(c.client_id::text) AS client_id,
      max(c.id::text) AS conversation_id
    FROM convs c
    WHERE EXISTS (SELECT 1 FROM msgs m WHERE m.cid = c.id AND m.direction = _direction)
    GROUP BY 1
  ),
  agg AS (
    SELECT
      coalesce(c.client_id::text, c.phone_e164, c.id::text) AS contact_key,
      count(*) FILTER (WHERE m.direction = 'inbound') AS messages_in,
      count(*) FILTER (WHERE m.direction = 'outbound') AS messages_out,
      min(m.sent_at) FILTER (WHERE m.direction = _direction) AS first_at,
      max(m.sent_at) FILTER (WHERE m.direction = _direction) AS last_at,
      max(m.sent_at) AS last_any_at,
      (array_agg(m.direction ORDER BY m.sent_at DESC, m.id DESC))[1] AS last_direction
    FROM msgs m
    JOIN convs c ON c.id = m.cid
    GROUP BY 1
  ),
  agents AS (
    SELECT
      coalesce(c.client_id::text, c.phone_e164, c.id::text) AS contact_key,
      coalesce(u.name, 'Não identificado (celular)') AS agent_name,
      count(*) AS msgs,
      max(m.sent_at) AS last_at
    FROM msgs m
    JOIN convs c ON c.id = m.cid
    LEFT JOIN public.users u ON u.id = m.sender_user_id
    WHERE m.direction = 'outbound'
    GROUP BY 1, 2
  ),
  agents_agg AS (
    SELECT contact_key,
      jsonb_agg(jsonb_build_object('name', agent_name, 'messages', msgs, 'last_at', last_at) ORDER BY msgs DESC) AS list
    FROM agents GROUP BY contact_key
  )
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'last_at') DESC), '[]'::jsonb) INTO _result
  FROM (
    SELECT jsonb_build_object(
      'contact_key', s.contact_key,
      'conversation_id', s.conversation_id,
      'client_id', s.client_id,
      'contact_name', coalesce(s.contact_name, s.phone_e164, 'Sem nome'),
      'phone_e164', s.phone_e164,
      'messages_in', a.messages_in,
      'messages_out', a.messages_out,
      'first_at', a.first_at,
      'last_at', coalesce(a.last_at, a.last_any_at),
      'last_direction', a.last_direction,
      'answered', (a.messages_out > 0),
      'agents', coalesce(ag.list, '[]'::jsonb)
    ) AS x
    FROM scope s
    JOIN agg a ON a.contact_key = s.contact_key
    LEFT JOIN agents_agg ag ON ag.contact_key = s.contact_key
  ) t;

  RETURN _result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.zapp_productivity_contacts(text, timestamptz, timestamptz, uuid, boolean, uuid, text) TO authenticated;