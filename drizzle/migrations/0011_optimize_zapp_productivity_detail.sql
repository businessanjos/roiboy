CREATE INDEX IF NOT EXISTS idx_zapp_messages_conv_sent_at ON public.zapp_messages (zapp_conversation_id, sent_at DESC);
CREATE OR REPLACE FUNCTION public.zapp_productivity_detail(_kind text, _sector_id text, _from timestamp with time zone, _to timestamp with time zone, _integration_id uuid DEFAULT NULL::uuid, _include_groups boolean DEFAULT false, _agent_user_id uuid DEFAULT NULL::uuid)
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

  IF _kind = 'unanswered' THEN
    WITH active AS (
      SELECT DISTINCT m.zapp_conversation_id AS cid
      FROM public.zapp_messages m
      WHERE m.account_id = _account
        AND m.sent_at >= _from AND m.sent_at < _to
        AND coalesce(m.is_deleted, false) = false
        AND (_agent_user_id IS NULL OR m.direction = 'inbound' OR m.sender_user_id = _agent_user_id)
    ),
    convs AS (
      SELECT c.id, c.client_id, c.contact_name, c.phone_e164
      FROM active a
      JOIN public.zapp_conversations c ON c.id = a.cid
      WHERE c.account_id = _account
        AND (_sector_id IS NULL OR c.sector_id = _sector_id)
        AND (_integration_id IS NULL OR c.integration_id = _integration_id)
        AND (_include_groups OR coalesce(c.is_group, false) = false)
        AND NOT public.zapp_should_exclude_contact(_account, c.phone_e164, c.client_id)
    ),
    last_msg AS (
      SELECT c.id AS cid, lm.direction, lm.sent_at
      FROM convs c
      CROSS JOIN LATERAL (
        SELECT m.direction, m.sent_at
        FROM public.zapp_messages m
        WHERE m.zapp_conversation_id = c.id
          AND coalesce(m.is_deleted, false) = false
          AND (_agent_user_id IS NULL OR m.direction = 'inbound' OR m.sender_user_id = _agent_user_id)
        ORDER BY m.sent_at DESC, m.id DESC
        LIMIT 1
      ) lm
    )
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'last_at') DESC), '[]'::jsonb)
    INTO _result
    FROM (
      SELECT jsonb_build_object(
        'conversation_id', lm.cid,
        'contact_name', coalesce(c.contact_name, c.phone_e164, 'Sem nome'),
        'phone_e164', c.phone_e164,
        'client_id', c.client_id,
        'last_at', lm.sent_at,
        'over_24h', lm.sent_at < now() - interval '24 hours',
        'messages_in', cnt.mi,
        'messages_out', cnt.mo
      ) AS x
      FROM last_msg lm
      JOIN convs c ON c.id = lm.cid
      CROSS JOIN LATERAL (
        SELECT count(DISTINCT coalesce(m.external_message_id, m.id::text)) FILTER (WHERE m.direction = 'inbound') AS mi,
               count(DISTINCT coalesce(m.external_message_id, m.id::text)) FILTER (WHERE m.direction = 'outbound') AS mo
        FROM public.zapp_messages m
        WHERE m.zapp_conversation_id = lm.cid
          AND m.sent_at >= _from AND m.sent_at < _to
          AND coalesce(m.is_deleted, false) = false
      ) cnt
      WHERE lm.direction = 'inbound'
    ) t;

  ELSIF _kind = 'never_messaged' THEN
    WITH convs AS (
      SELECT c.id, c.client_id, c.contact_name, c.phone_e164, c.last_message_at,
             public.zapp_phone_core(c.phone_e164) AS pcore
      FROM public.zapp_conversations c
      WHERE c.account_id = _account
        AND (_sector_id IS NULL OR c.sector_id = _sector_id)
        AND (_integration_id IS NULL OR c.integration_id = _integration_id)
        AND (_include_groups OR coalesce(c.is_group, false) = false)
        AND NOT public.zapp_should_exclude_contact(_account, c.phone_e164, c.client_id)
    ),
    client_base AS (
      SELECT DISTINCT cl.id, public.zapp_phone_core(cl.phone_e164) AS pcore
      FROM public.clients cl
      JOIN public.client_contracts cc ON cc.client_id = cl.id AND cc.status = 'active'
      WHERE cl.account_id = _account
    ),
    scope AS (
      SELECT cb.id AS client_id
      FROM client_base cb
      WHERE EXISTS (
        SELECT 1 FROM convs c
        WHERE c.client_id = cb.id OR (cb.pcore IS NOT NULL AND c.pcore = cb.pcore)
      )
      AND NOT EXISTS (
        SELECT 1 FROM convs c
        JOIN public.zapp_messages m3 ON m3.zapp_conversation_id = c.id
          AND m3.direction = 'inbound'
          AND coalesce(m3.is_deleted, false) = false
        WHERE c.client_id = cb.id OR (cb.pcore IS NOT NULL AND c.pcore = cb.pcore)
      )
    )
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'last_out_at') DESC NULLS LAST, (x->>'client_name')), '[]'::jsonb)
    INTO _result
    FROM (
      SELECT jsonb_build_object(
        'client_id', s.client_id,
        'client_name', coalesce(cl.full_name, 'Sem nome'),
        'phone_e164', cl.phone_e164,
        'responsible', ru.name,
        'conversation_id', cv.id,
        'contact_name', cv.contact_name,
        'last_out_at', agg.last_out_at,
        'messages_out', agg.messages_out
      ) AS x
      FROM scope s
      JOIN public.clients cl ON cl.id = s.client_id
      LEFT JOIN public.users ru ON ru.id = cl.responsible_user_id
      LEFT JOIN LATERAL (
        SELECT c.id, c.contact_name
        FROM convs c
        WHERE c.client_id = s.client_id
           OR (public.zapp_phone_core(cl.phone_e164) IS NOT NULL AND c.pcore = public.zapp_phone_core(cl.phone_e164))
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT 1
      ) cv ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS messages_out, max(m.sent_at) AS last_out_at
        FROM public.zapp_messages m
        WHERE m.zapp_conversation_id = cv.id
          AND m.account_id = _account
          AND coalesce(m.is_deleted, false) = false
          AND m.direction = 'outbound'
          AND m.sent_at >= _from AND m.sent_at < _to
      ) agg ON cv.id IS NOT NULL
    ) t;

  ELSE
    WITH convs AS (
      SELECT c.id, c.client_id, c.phone_e164,
             public.zapp_phone_core(c.phone_e164) AS pcore
      FROM public.zapp_conversations c
      WHERE c.account_id = _account
        AND (_sector_id IS NULL OR c.sector_id = _sector_id)
        AND (_integration_id IS NULL OR c.integration_id = _integration_id)
        AND (_include_groups OR coalesce(c.is_group, false) = false)
        AND NOT public.zapp_should_exclude_contact(_account, c.phone_e164, c.client_id)
    ),
    client_base AS (
      SELECT DISTINCT cl.id, public.zapp_phone_core(cl.phone_e164) AS pcore
      FROM public.clients cl
      JOIN public.client_contracts cc ON cc.client_id = cl.id AND cc.status = 'active'
      WHERE cl.account_id = _account
    ),
    scope AS (
      SELECT cb.id AS client_id
      FROM client_base cb
      WHERE NOT EXISTS (
        SELECT 1 FROM convs c
        WHERE c.client_id = cb.id OR (cb.pcore IS NOT NULL AND c.pcore = cb.pcore)
      )
    )
    SELECT coalesce(jsonb_agg(x ORDER BY (x->>'client_name')), '[]'::jsonb)
    INTO _result
    FROM (
      SELECT jsonb_build_object(
        'client_id', s.client_id,
        'client_name', coalesce(cl.full_name, 'Sem nome'),
        'phone_e164', cl.phone_e164,
        'responsible', ru.name
      ) AS x
      FROM scope s
      JOIN public.clients cl ON cl.id = s.client_id
      LEFT JOIN public.users ru ON ru.id = cl.responsible_user_id
    ) t;
  END IF;

  RETURN _result;
END;
$function$;