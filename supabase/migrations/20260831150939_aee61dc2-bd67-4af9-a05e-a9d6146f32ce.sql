CREATE OR REPLACE FUNCTION public.zapp_productivity_metrics(_sector_id text, _from timestamp with time zone, _to timestamp with time zone, _integration_id uuid DEFAULT NULL::uuid, _include_groups boolean DEFAULT false, _agent_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _account uuid;
  _result jsonb;
  _risk text[] := ARRAY['cancelar','cancelamento','cancelando','pausar','pausa ','trancar','trancamento','desistir','reembolso','estorno','rescis','insatisfeit','decepcion','sair da mentoria','encerrar contrato','quero sair','não quero mais','nao quero mais'];
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
  excluded_groups AS (
    SELECT count(*) AS n
    FROM public.zapp_conversations c
    WHERE c.account_id = _account
      AND (_sector_id IS NULL OR c.sector_id = _sector_id)
      AND (_integration_id IS NULL OR c.integration_id = _integration_id)
      AND coalesce(c.is_group, false) = true
      AND NOT _include_groups
  ),
  dedup AS (
    SELECT DISTINCT ON (coalesce(m.external_message_id, m.id::text))
      m.id, m.zapp_conversation_id AS cid, m.direction, m.sent_at, m.sender_user_id,
      coalesce(m.synced_from_history, false) AS from_history,
      coalesce(m.content, m.transcription, '') AS body
    FROM public.zapp_messages m
    JOIN convs c ON c.id = m.zapp_conversation_id
    WHERE m.account_id = _account
      AND coalesce(m.is_deleted, false) = false
      AND (_agent_user_id IS NULL OR m.direction = 'inbound' OR m.sender_user_id = _agent_user_id)
    ORDER BY coalesce(m.external_message_id, m.id::text), m.sent_at ASC, m.id ASC
  ),
  dupes AS (
    SELECT count(*) AS n
    FROM (
      SELECT m.external_message_id
      FROM public.zapp_messages m
      JOIN convs c ON c.id = m.zapp_conversation_id
      WHERE m.account_id = _account
        AND coalesce(m.is_deleted, false) = false
        AND m.external_message_id IS NOT NULL
        AND m.sent_at >= _from AND m.sent_at < _to
      GROUP BY m.external_message_id
      HAVING count(*) > 1
    ) d
  ),
  msgs AS (
    SELECT d.id, d.cid, d.direction, d.sent_at, d.sender_user_id, d.from_history, d.body
    FROM dedup d
    WHERE d.sent_at >= _from AND d.sent_at < _to
  ),
  msgs_ext AS (
    SELECT d.id, d.cid, d.direction, d.sent_at, d.sender_user_id
    FROM dedup d
    WHERE d.sent_at >= (_from - interval '48 hours') AND d.sent_at < _to
  ),
  first_ever AS (
    SELECT DISTINCT ON (d.cid)
      d.cid, d.direction, d.sent_at, d.sender_user_id, d.from_history
    FROM dedup d
    ORDER BY d.cid, d.sent_at ASC, d.id ASC
  ),
  new_candidates AS (
    SELECT f.*, c.created_at AS conv_created_at
    FROM first_ever f
    JOIN convs c ON c.id = f.cid
    WHERE f.sent_at >= _from AND f.sent_at < _to
  ),
  new_convs AS (
    SELECT * FROM new_candidates
    WHERE from_history = false
      AND conv_created_at < _to
      AND conv_created_at >= (_from - interval '48 hours')
  ),
  per_day AS (
    SELECT to_char(date_trunc('day', m.sent_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day,
           count(DISTINCT m.cid) AS convs,
           count(*) FILTER (WHERE m.direction = 'inbound') AS inbound,
           count(*) FILTER (WHERE m.direction = 'outbound') AS outbound
    FROM msgs m GROUP BY 1
  ),
  new_per_day AS (
    SELECT to_char(date_trunc('day', n.sent_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day,
           count(*) FILTER (WHERE n.direction = 'inbound') AS new_by_client,
           count(*) FILTER (WHERE n.direction = 'outbound') AS new_by_team
    FROM new_convs n GROUP BY 1
  ),
  seq AS (
    SELECT m.*,
      lag(m.direction) OVER (PARTITION BY m.cid ORDER BY m.sent_at, m.id) AS prev_dir,
      max(m.sent_at) FILTER (WHERE m.direction = 'inbound')
        OVER (PARTITION BY m.cid ORDER BY m.sent_at, m.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS last_inbound_at
    FROM msgs_ext m
  ),
  responses AS (
    SELECT s.cid, s.sender_user_id,
           EXTRACT(EPOCH FROM (s.sent_at - s.last_inbound_at)) AS secs
    FROM seq s
    WHERE s.direction = 'outbound'
      AND s.prev_dir = 'inbound'
      AND s.last_inbound_at IS NOT NULL
      AND s.sent_at >= _from
      AND s.sent_at > s.last_inbound_at
      AND EXTRACT(EPOCH FROM (s.sent_at - s.last_inbound_at)) < 172800
  ),
  last_msg AS (
    SELECT DISTINCT ON (d.cid) d.cid, d.direction, d.sent_at
    FROM dedup d
    JOIN (SELECT DISTINCT cid FROM msgs) a ON a.cid = d.cid
    ORDER BY d.cid, d.sent_at DESC, d.id DESC
  ),
  client_base AS (
    SELECT DISTINCT cl.id
    FROM public.clients cl
    JOIN public.client_contracts cc ON cc.client_id = cl.id AND cc.status = 'active'
    WHERE cl.account_id = _account
  ),
  client_scope AS (
    SELECT cb.id,
      EXISTS (SELECT 1 FROM convs_raw c WHERE c.client_id = cb.id) AS has_conv,
      EXISTS (
        SELECT 1 FROM convs_raw c
        JOIN public.zapp_messages m3 ON m3.zapp_conversation_id = c.id
          AND m3.direction = 'inbound'
          AND coalesce(m3.is_deleted, false) = false
        WHERE c.client_id = cb.id
      ) AS has_inbound
    FROM client_base cb
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE direction = 'inbound') AS messages_in,
      count(*) FILTER (WHERE direction = 'outbound') AS messages_out,
      count(*) FILTER (WHERE direction = 'outbound' AND sender_user_id IS NULL) AS messages_out_unattributed,
      count(*) FILTER (WHERE from_history) AS messages_from_history,
      count(DISTINCT cid) AS active_conversations
    FROM msgs
  )
  SELECT jsonb_build_object(
    'sector_id', _sector_id,
    'integration_id', _integration_id,
    'include_groups', _include_groups,
    'agent_user_id', _agent_user_id,
    'from', _from,
    'to', _to,
    'messages_in', (SELECT messages_in FROM totals),
    'messages_out', (SELECT messages_out FROM totals),
    'messages_out_unattributed', (SELECT messages_out_unattributed FROM totals),
    'messages_from_history', (SELECT messages_from_history FROM totals),
    'group_conversations_excluded', (SELECT n FROM excluded_groups),
    'active_conversations', (SELECT active_conversations FROM totals),
    'total_conversations', (SELECT count(*) FROM convs),
    'new_conversations', (SELECT count(*) FROM new_convs),
    'new_conversations_from_history', (SELECT count(*) FROM new_candidates WHERE from_history),
    'new_by_client', (SELECT count(*) FROM new_convs WHERE direction = 'inbound'),
    'new_by_team', (SELECT count(*) FROM new_convs WHERE direction = 'outbound'),
    'new_by_team_agent', (
      SELECT coalesce(jsonb_agg(x ORDER BY (x->>'count')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('user_id', u.id, 'name', coalesce(u.name, 'Sem atendente identificado'), 'count', count(*)) AS x
        FROM new_convs n
        LEFT JOIN public.users u ON u.id = n.sender_user_id
        WHERE n.direction = 'outbound'
        GROUP BY u.id, u.name
      ) s
    ),
    'active_days', (SELECT count(*) FROM per_day),
    'avg_conversations_per_day', (SELECT round(avg(convs)::numeric, 1) FROM per_day),
    'avg_messages_per_day', (SELECT round(avg(inbound + outbound)::numeric, 1) FROM per_day),
    'avg_new_conversations_per_day', (
      SELECT CASE WHEN (SELECT count(*) FROM per_day) = 0 THEN NULL
        ELSE round((SELECT count(*) FROM new_convs)::numeric / (SELECT count(*) FROM per_day), 1) END
    ),
    'by_day_new', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'new_by_client', new_by_client, 'new_by_team', new_by_team) ORDER BY day), '[]'::jsonb)
      FROM new_per_day
    ),
    'responses_count', (SELECT count(*) FROM responses),
    'avg_response_seconds', (SELECT round(avg(secs)) FROM responses),
    'median_response_seconds', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY secs)::numeric) FROM responses),
    'p90_response_seconds', (SELECT round(percentile_cont(0.9) WITHIN GROUP (ORDER BY secs)::numeric) FROM responses),
    'responses_under_5min_pct', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE secs <= 300) / count(*), 1) END FROM responses),
    'contacts_reached_by_team', (
      SELECT count(DISTINCT coalesce(c.client_id::text, c.phone_e164, m.cid::text))
      FROM msgs m JOIN convs c ON c.id = m.cid
      WHERE m.direction = 'outbound'
    ),
    'contacts_that_messaged', (
      SELECT count(DISTINCT coalesce(c.client_id::text, c.phone_e164, m.cid::text))
      FROM msgs m JOIN convs c ON c.id = m.cid
      WHERE m.direction = 'inbound'
    ),
    'clients_reached_by_team', (
      SELECT count(DISTINCT c.client_id)
      FROM msgs m JOIN convs c ON c.id = m.cid
      WHERE m.direction = 'outbound' AND c.client_id IS NOT NULL
    ),
    'clients_that_messaged', (
      SELECT count(DISTINCT c.client_id)
      FROM msgs m JOIN convs c ON c.id = m.cid
      WHERE m.direction = 'inbound' AND c.client_id IS NOT NULL
    ),
    'conversations_with_inbound', (SELECT count(DISTINCT cid) FROM msgs WHERE direction = 'inbound'),
    'unanswered_conversations', (SELECT count(*) FROM last_msg WHERE direction = 'inbound'),
    'unanswered_over_24h', (SELECT count(*) FROM last_msg WHERE direction = 'inbound' AND sent_at < now() - interval '24 hours'),
    'silent_conversations', (
      SELECT count(*) FROM convs c
      WHERE NOT EXISTS (SELECT 1 FROM msgs m WHERE m.cid = c.id AND m.direction = 'inbound')
    ),
    'clients_active_base', (SELECT count(*) FROM client_scope),
    'clients_no_conversation', (SELECT count(*) FROM client_scope WHERE NOT has_conv),
    'clients_never_messaged', (SELECT count(*) FROM client_scope WHERE has_conv AND NOT has_inbound),
    'duplicates_ignored', (SELECT n FROM dupes),
    'risk_mentions', (
      SELECT count(*) FROM msgs m
      WHERE m.direction = 'inbound' AND m.body ILIKE ANY (SELECT '%' || unnest(_risk) || '%')
    ),
    'risk_conversations', (
      SELECT count(DISTINCT m.cid) FROM msgs m
      WHERE m.direction = 'inbound' AND m.body ILIKE ANY (SELECT '%' || unnest(_risk) || '%')
    ),
    'risk_samples', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'conversation_id', m.cid,
          'contact_name', c.contact_name,
          'client_id', c.client_id,
          'sent_at', m.sent_at,
          'excerpt', left(m.body, 220)
        ) AS x
        FROM msgs m JOIN convs c ON c.id = m.cid
        WHERE m.direction = 'inbound' AND m.body ILIKE ANY (SELECT '%' || unnest(_risk) || '%')
        ORDER BY m.sent_at DESC
        LIMIT 40
      ) s
    ),
    'by_agent', (
      SELECT coalesce(jsonb_agg(x ORDER BY (x->>'messages_sent')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'user_id', a.user_id,
          'name', coalesce(a.name, 'Sem atendente identificado'),
          'messages_sent', a.messages_sent,
          'conversations', a.conversations,
          'avg_conversations_per_day', a.avg_conversations_per_day,
          'new_started', (SELECT count(*) FROM new_convs n WHERE n.direction = 'outbound' AND n.sender_user_id = a.sender_user_id),
          'responses_count', (SELECT count(*) FROM responses r WHERE r.sender_user_id = a.sender_user_id),
          'median_response_seconds', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.secs)::numeric) FROM responses r WHERE r.sender_user_id = a.sender_user_id),
          'avg_response_seconds', (SELECT round(avg(r.secs)) FROM responses r WHERE r.sender_user_id = a.sender_user_id)
        ) AS x
        FROM (
          SELECT u.id AS user_id, u.name, m.sender_user_id,
                 count(*) AS messages_sent,
                 count(DISTINCT m.cid) AS conversations,
                 round((count(DISTINCT m.cid)::numeric / NULLIF(count(DISTINCT date_trunc('day', m.sent_at AT TIME ZONE 'America/Sao_Paulo')), 0)), 1) AS avg_conversations_per_day
          FROM msgs m
          LEFT JOIN public.users u ON u.id = m.sender_user_id
          WHERE m.direction = 'outbound' AND m.sender_user_id IS NOT NULL
          GROUP BY u.id, u.name, m.sender_user_id
        ) a
      ) s
    ),
    'by_day', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'inbound', inbound, 'outbound', outbound, 'conversations', convs) ORDER BY day), '[]'::jsonb)
      FROM per_day
    ),
    'by_hour', (
      SELECT coalesce(jsonb_agg(x ORDER BY (x->>'hour')::int), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('hour', h.hour, 'inbound', h.inbound, 'outbound', h.outbound) AS x
        FROM (
          SELECT EXTRACT(HOUR FROM m.sent_at AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
                 count(*) FILTER (WHERE m.direction = 'inbound') AS inbound,
                 count(*) FILTER (WHERE m.direction = 'outbound') AS outbound
          FROM msgs m
          GROUP BY 1
        ) h
      ) s
    )
  ) INTO _result;

  RETURN _result;
END;
$function$;