CREATE TABLE IF NOT EXISTS public.zapp_metrics_excluded_conversations (
  conversation_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.zapp_metrics_excluded_conversations TO authenticated;
GRANT ALL ON public.zapp_metrics_excluded_conversations TO service_role;
ALTER TABLE public.zapp_metrics_excluded_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics exclusions by account (managers)" ON public.zapp_metrics_excluded_conversations
  FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.zapp_can_view_analytics())
  WITH CHECK (account_id = public.get_current_user_account_id() AND public.zapp_can_view_analytics());

CREATE OR REPLACE FUNCTION public.zapp_is_followup_group(_conv uuid, _name text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(_name,'') !~* '(financeiro|bugs?\W*roy|\mbugs?\M|tech supor|cancelamento|congelamento|everton\W*pieri|canal\W*anjo|anjos?\W*consultor|\manjos\M|eternum\W*canal|canal\W*\W*eternum)'
     AND NOT EXISTS (SELECT 1 FROM public.zapp_metrics_excluded_conversations x WHERE x.conversation_id = _conv)
     AND (SELECT count(*) FROM public.zapp_group_clients g WHERE g.conversation_id = _conv) BETWEEN 1 AND 19;
$function$;

DROP FUNCTION IF EXISTS public.zapp_productivity_agent_conversations(text, timestamptz, timestamptz, uuid, boolean, uuid, text, integer, integer);

CREATE FUNCTION public.zapp_productivity_agent_conversations(_sector_id text, _from timestamptz, _to timestamptz, _integration_id uuid DEFAULT NULL, _include_groups boolean DEFAULT false, _user_id uuid DEFAULT NULL, _origin text DEFAULT NULL, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _mode text DEFAULT 'sent')
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _account uuid; _result jsonb;
BEGIN
  IF NOT public.zapp_can_view_analytics() THEN
    RAISE EXCEPTION 'Sem permissão para acessar as métricas do ROY zAPP';
  END IF;
  SELECT account_id INTO _account FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  IF _account IS NULL THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;

  WITH convs AS (
    SELECT c.id, c.contact_name, c.phone_e164, c.client_id, c.is_group, c.created_at
    FROM public.zapp_conversations c
    WHERE c.account_id = _account
      AND (_sector_id IS NULL OR c.sector_id = _sector_id)
      AND (_integration_id IS NULL OR c.integration_id = _integration_id)
      AND (_include_groups OR coalesce(c.is_group, false) = false OR public.zapp_is_followup_group(c.id, c.contact_name))
      AND NOT public.zapp_should_exclude_contact(_account, c.phone_e164, c.client_id)
      AND NOT EXISTS (SELECT 1 FROM public.zapp_metrics_excluded_conversations x WHERE x.conversation_id = c.id)
  ),
  su AS (SELECT key, id FROM public.zapp_signature_user_keys(_account)),
  m0 AS (
    SELECT DISTINCT ON (coalesce(m.external_message_id, m.id::text))
      m.zapp_conversation_id AS cid, m.sent_at, m.sender_user_id, m.sender_name,
      coalesce(m.synced_from_history, false) AS from_history,
      CASE WHEN m.sender_user_id IS NULL AND left(m.content, 1) = '*' THEN public.zapp_signature_name(m.content) END AS sig
    FROM public.zapp_messages m
    JOIN convs c ON c.id = m.zapp_conversation_id
    WHERE m.account_id = _account AND m.direction = 'outbound'
      AND coalesce(m.is_deleted, false) = false
      AND m.sent_at >= _from AND m.sent_at < _to
      AND m.sender_user_id IS DISTINCT FROM '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
    ORDER BY coalesce(m.external_message_id, m.id::text), m.sent_at
  ),
  m1 AS (
    SELECT m0.cid, m0.sent_at, coalesce(m0.sender_user_id, su.id) AS uid,
      CASE
        WHEN coalesce(m0.sender_user_id, su.id) IS NOT NULL THEN NULL
        WHEN m0.from_history THEN 'history'
        WHEN m0.sender_name ILIKE 'canal%' THEN 'channel'
        WHEN m0.sender_name ILIKE '%automa%' THEN 'automation'
        WHEN m0.sig IS NOT NULL THEN 'signed:' || m0.sig
        ELSE 'device'
      END AS origin
    FROM m0 LEFT JOIN su ON su.key = m0.sig
  ),
  agg0 AS (
    SELECT m1.cid, count(*) AS sent, max(m1.sent_at) AS last_sent
    FROM m1
    WHERE (_user_id IS NOT NULL AND m1.uid = _user_id) OR (_user_id IS NULL AND m1.origin = _origin)
    GROUP BY m1.cid
  ),
  agg AS (
    SELECT a.* FROM agg0 a JOIN convs c ON c.id = a.cid
    WHERE coalesce(_mode, 'sent') <> 'new' OR (
      c.created_at >= (_from - interval '48 hours') AND c.created_at < _to
      AND EXISTS (
        SELECT 1 FROM (
          SELECT f.direction, f.sent_at, coalesce(f.synced_from_history, false) AS h
          FROM public.zapp_messages f
          WHERE f.zapp_conversation_id = a.cid AND coalesce(f.is_deleted, false) = false
          ORDER BY f.sent_at ASC, f.id ASC LIMIT 1
        ) fe
        WHERE fe.direction = 'outbound' AND NOT fe.h AND fe.sent_at >= _from AND fe.sent_at < _to
      )
    )
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM agg),
    'rows', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'conversation_id', a.cid, 'contact_name', c.contact_name, 'phone', c.phone_e164,
        'is_group', coalesce(c.is_group, false), 'sent', a.sent, 'last_sent', a.last_sent
      ) ORDER BY a.sent DESC, a.last_sent DESC)
      FROM (SELECT * FROM agg ORDER BY sent DESC, last_sent DESC LIMIT greatest(1, least(_limit, 200)) OFFSET greatest(0, _offset)) a
      JOIN convs c ON c.id = a.cid
    ), '[]'::jsonb)
  ) INTO _result;
  RETURN _result;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.zapp_productivity_agent_conversations(text, timestamptz, timestamptz, uuid, boolean, uuid, text, integer, integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.zapp_productivity_agent_conversations(text, timestamptz, timestamptz, uuid, boolean, uuid, text, integer, integer, text) TO authenticated;