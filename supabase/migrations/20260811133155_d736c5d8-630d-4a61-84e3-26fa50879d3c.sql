CREATE OR REPLACE FUNCTION public.zapp_productivity_metrics(
  _sector_id text,
  _from timestamptz,
  _to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  WITH convs AS (
    SELECT c.id, c.client_id, c.is_group, c.contact_name, c.phone_e164
    FROM public.zapp_conversations c
    WHERE c.account_id = _account
      AND (_sector_id IS NULL OR c.sector_id = _sector_id)
  ),
  msgs AS (
    SELECT m.id, m.zapp_conversation_id AS cid, m.direction, m.sent_at, m.sender_user_id,
           coalesce(m.content, m.transcription, '') AS body
    FROM public.zapp_messages m
    JOIN convs c ON c.id = m.zapp_conversation_id
    WHERE m.account_id = _account
      AND m.sent_at >= _from AND m.sent_at < _to
      AND coalesce(m.is_deleted, false) = false
  ),
  seq AS (
    SELECT m.*,
      lag(m.direction) OVER (PARTITION BY m.cid ORDER BY m.sent_at, m.id) AS prev_dir,
      max(m.sent_at) FILTER (WHERE m.direction = 'inbound')
        OVER (PARTITION BY m.cid ORDER BY m.sent_at, m.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS last_inbound_at
    FROM msgs m
  ),
  responses AS (
    SELECT s.cid, s.sender_user_id,
           EXTRACT(EPOCH FROM (s.sent_at - s.last_inbound_at)) AS secs
    FROM seq s
    WHERE s.direction = 'outbound'
      AND s.prev_dir = 'inbound'
      AND s.last_inbound_at IS NOT NULL
      AND s.sent_at > s.last_inbound_at
      AND EXTRACT(EPOCH FROM (s.sent_at - s.last_inbound_at)) < 172800
  ),
  last_msg AS (
    SELECT DISTINCT ON (cid) cid, direction, sent_at
    FROM msgs ORDER BY cid, sent_at DESC, id DESC
  ),
  totals AS (
    SELECT
      count(*) FILTER (WHERE direction = 'inbound') AS messages_in,
      count(*) FILTER (WHERE direction = 'outbound') AS messages_out,
      count(DISTINCT cid) AS active_conversations
    FROM msgs
  )
  SELECT jsonb_build_object(
    'sector_id', _sector_id,
    'from', _from,
    'to', _to,
    'messages_in', (SELECT messages_in FROM totals),
    'messages_out', (SELECT messages_out FROM totals),
    'active_conversations', (SELECT active_conversations FROM totals),
    'total_conversations', (SELECT count(*) FROM convs),
    'avg_response_seconds', (SELECT round(avg(secs)) FROM responses),
    'median_response_seconds', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY secs)::numeric) FROM responses),
    'p90_response_seconds', (SELECT round(percentile_cont(0.9) WITHIN GROUP (ORDER BY secs)::numeric) FROM responses),
    'responses_under_5min_pct', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE secs <= 300) / count(*), 1) END FROM responses),
    'conversations_with_inbound', (SELECT count(DISTINCT cid) FROM msgs WHERE direction = 'inbound'),
    'unanswered_conversations', (SELECT count(*) FROM last_msg WHERE direction = 'inbound'),
    'unanswered_over_24h', (SELECT count(*) FROM last_msg WHERE direction = 'inbound' AND sent_at < now() - interval '24 hours'),
    'silent_conversations', (
      SELECT count(*) FROM convs c
      WHERE NOT EXISTS (SELECT 1 FROM msgs m WHERE m.cid = c.id AND m.direction = 'inbound')
    ),
    'clients_never_messaged', (
      SELECT count(*) FROM public.clients cl
      WHERE cl.account_id = _account
        AND cl.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.zapp_conversations zc
          JOIN public.zapp_messages zm ON zm.zapp_conversation_id = zc.id AND zm.direction = 'inbound'
          WHERE zc.client_id = cl.id AND zc.account_id = _account
            AND (_sector_id IS NULL OR zc.sector_id = _sector_id)
        )
    ),
    'risk_mentions', (
      SELECT count(*) FROM msgs m
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
          'name', coalesce(a.name, 'Sem atendente'),
          'messages_sent', a.messages_sent,
          'conversations', a.conversations,
          'avg_response_seconds', (SELECT round(avg(r.secs)) FROM responses r WHERE r.sender_user_id = a.sender_user_id)
        ) AS x
        FROM (
          SELECT u.id AS user_id, u.name, m.sender_user_id,
                 count(*) AS messages_sent,
                 count(DISTINCT m.cid) AS conversations
          FROM msgs m
          LEFT JOIN public.users u ON u.id = m.sender_user_id
          WHERE m.direction = 'outbound' AND m.sender_user_id IS NOT NULL
          GROUP BY u.id, u.name, m.sender_user_id
        ) a
      ) s
    ),
    'by_day', (
      SELECT coalesce(jsonb_agg(x ORDER BY x->>'day'), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('day', d.day, 'inbound', d.inbound, 'outbound', d.outbound) AS x
        FROM (
          SELECT to_char(date_trunc('day', m.sent_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day,
                 count(*) FILTER (WHERE m.direction = 'inbound') AS inbound,
                 count(*) FILTER (WHERE m.direction = 'outbound') AS outbound
          FROM msgs m
          GROUP BY 1
        ) d
      ) s
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
$$;

GRANT EXECUTE ON FUNCTION public.zapp_productivity_metrics(text, timestamptz, timestamptz) TO authenticated;