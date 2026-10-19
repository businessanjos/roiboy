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
    WITH internal_phones AS MATERIALIZED (
      SELECT public.zapp_phone_core(i.phone_e164) AS p FROM public.zapp_internal_contacts i WHERE i.account_id = _account
      UNION
      SELECT public.zapp_phone_core(h.phone) FROM public.hr_collaborators h WHERE h.account_id = _account AND h.phone IS NOT NULL
    ),
    active_clients AS MATERIALIZED (
      SELECT DISTINCT cc.client_id FROM public.client_contracts cc WHERE cc.status = 'active' AND cc.client_id IS NOT NULL
    ),
    active AS (
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
        AND NOT (
          public.zapp_phone_core(c.phone_e164) IS NOT NULL
          AND public.zapp_phone_core(c.phone_e164) IN (SELECT p FROM internal_phones WHERE p IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM active_clients ac WHERE ac.client_id = c.client_id)
        )
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
    WITH internal_phones AS MATERIALIZED (
      SELECT public.zapp_phone_core(i.phone_e164) AS p FROM public.zapp_internal_contacts i WHERE i.account_id = _account
      UNION
      SELECT public.zapp_phone_core(h.phone) FROM public.hr_collaborators h WHERE h.account_id = _account AND h.phone IS NOT NULL
    ),
    active_clients AS MATERIALIZED (
      SELECT DISTINCT cc.client_id FROM public.client_contracts cc WHERE cc.status = 'active' AND cc.client_id IS NOT NULL
    ),
    convs AS MATERIALIZED (
      SELECT c.id, c.client_id, c.contact_name, c.phone_e164, c.last_message_at,
             public.zapp_phone_core(c.phone_e164) AS pcore
      FROM public.zapp_conversations c
      WHERE c.account_id = _account
        AND (_sector_id IS NULL OR c.sector_id = _sector_id)
        AND (_integration_id IS NULL OR c.integration_id = _integration_id)
        AND (_include_groups OR coalesce(c.is_group, false) = false)
        AND NOT (
          public.zapp_phone_core(c.phone_e164) IS NOT NULL
          AND public.zapp_phone_core(c.phone_e164) IN (SELECT p FROM internal_phones WHERE p IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM active_clients ac WHERE ac.client_id = c.client_id)
        )
    ),
    inbound_convs AS MATERIALIZED (
      SELECT c.client_id, c.pcore FROM convs c
      WHERE EXISTS (SELECT 1 FROM public.zapp_messages m3 WHERE m3.zapp_conversation_id = c.id
        AND m3.direction = 'inbound' AND coalesce(m3.is_deleted, false) = false)
    ),
    client_base AS MATERIALIZED (
      SELECT DISTINCT cl.id, public.zapp_phone_core(cl.phone_e164) AS pcore
      FROM public.clients cl
      JOIN public.client_contracts cc ON cc.client_id = cl.id AND cc.status = 'active'
      WHERE cl.account_id = _account
    ),
    scope AS (
      SELECT cb.id AS client_id
      FROM client_base cb
      WHERE (cb.id IN (SELECT client_id FROM convs WHERE client_id IS NOT NULL)
             OR (cb.pcore IS NOT NULL AND cb.pcore IN (SELECT pcore FROM convs WHERE pcore IS NOT NULL)))
      AND NOT (cb.id IN (SELECT client_id FROM inbound_convs WHERE client_id IS NOT NULL)
             OR (cb.pcore IS NOT NULL AND cb.pcore IN (SELECT pcore FROM inbound_convs WHERE pcore IS NOT NULL)))
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
    WITH internal_phones AS MATERIALIZED (
      SELECT public.zapp_phone_core(i.phone_e164) AS p FROM public.zapp_internal_contacts i WHERE i.account_id = _account
      UNION
      SELECT public.zapp_phone_core(h.phone) FROM public.hr_collaborators h WHERE h.account_id = _account AND h.phone IS NOT NULL
    ),
    active_clients AS MATERIALIZED (
      SELECT DISTINCT cc.client_id FROM public.client_contracts cc WHERE cc.status = 'active' AND cc.client_id IS NOT NULL
    ),
    convs AS MATERIALIZED (
      SELECT c.id, c.client_id, c.phone_e164,
             public.zapp_phone_core(c.phone_e164) AS pcore
      FROM public.zapp_conversations c
      WHERE c.account_id = _account
        AND (_sector_id IS NULL OR c.sector_id = _sector_id)
        AND (_integration_id IS NULL OR c.integration_id = _integration_id)
        AND (_include_groups OR coalesce(c.is_group, false) = false)
        AND NOT (
          public.zapp_phone_core(c.phone_e164) IS NOT NULL
          AND public.zapp_phone_core(c.phone_e164) IN (SELECT p FROM internal_phones WHERE p IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM active_clients ac WHERE ac.client_id = c.client_id)
        )
    ),
    client_base AS MATERIALIZED (
      SELECT DISTINCT cl.id, public.zapp_phone_core(cl.phone_e164) AS pcore
      FROM public.clients cl
      JOIN public.client_contracts cc ON cc.client_id = cl.id AND cc.status = 'active'
      WHERE cl.account_id = _account
    ),
    scope AS (
      SELECT cb.id AS client_id
      FROM client_base cb
      WHERE NOT (cb.id IN (SELECT client_id FROM convs WHERE client_id IS NOT NULL)
             OR (cb.pcore IS NOT NULL AND cb.pcore IN (SELECT pcore FROM convs WHERE pcore IS NOT NULL)))
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