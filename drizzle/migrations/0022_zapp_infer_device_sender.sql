CREATE OR REPLACE FUNCTION public.zapp_infer_sender(_cid uuid, _sent_at timestamptz)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  -- Envio pelo celular sem atendente: herda o dono da conversa naquele momento.
  SELECT coalesce(
    (SELECT p.sender_user_id FROM public.zapp_messages p
      WHERE p.zapp_conversation_id = _cid AND p.direction = 'outbound' AND p.sender_user_id IS NOT NULL
        AND p.sender_user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
        AND coalesce(p.is_deleted,false) = false
        AND p.sent_at <= _sent_at AND p.sent_at >= _sent_at - interval '7 days'
      ORDER BY p.sent_at DESC LIMIT 1),
    (SELECT p.sender_user_id FROM public.zapp_messages p
      WHERE p.zapp_conversation_id = _cid AND p.direction = 'outbound' AND p.sender_user_id IS NOT NULL
        AND p.sender_user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
        AND coalesce(p.is_deleted,false) = false
        AND p.sent_at > _sent_at AND p.sent_at <= _sent_at + interval '7 days'
      ORDER BY p.sent_at ASC LIMIT 1),
    (SELECT ag.user_id FROM public.zapp_conversation_assignments a
      JOIN public.zapp_agents ag ON ag.id = a.agent_id
      WHERE a.zapp_conversation_id = _cid AND a.agent_id IS NOT NULL
        AND ag.user_id <> '14389b62-d4a1-4837-9aee-61a19b28c383'::uuid
      ORDER BY a.updated_at DESC NULLS LAST LIMIT 1)
  );
$function$;
REVOKE EXECUTE ON FUNCTION public.zapp_infer_sender(uuid, timestamptz) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.zapp_infer_sender(uuid, timestamptz) TO authenticated;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.zapp_productivity_metrics'::regproc);
  d := replace(d, 'coalesce(d.sender_user_id, su.id)', 'coalesce(d.sender_user_id, su.id, inf.uid)');
  d := replace(d, E'LEFT JOIN sig_users su ON su.key = d.sig\n', E'LEFT JOIN sig_users su ON su.key = d.sig\n    LEFT JOIN LATERAL (SELECT public.zapp_infer_sender(d.cid, d.sent_at) AS uid WHERE d.direction = ''outbound'' AND d.sender_user_id IS NULL AND su.id IS NULL AND NOT d.from_history AND coalesce(d.sender_name,'''') NOT ILIKE ''canal%'' AND coalesce(d.sender_name,'''') NOT ILIKE ''%automa%'' AND d.sig IS NULL AND d.sent_at >= (_from - interval ''48 hours'')) inf ON true\n');
  IF position('inf.uid' in d) = 0 OR position('LATERAL' in d) = 0 THEN RAISE EXCEPTION 'metrics patch failed'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.zapp_productivity_agent_conversations'::regproc);
  d := replace(d, 'coalesce(m0.sender_user_id, su.id) AS uid,', 'coalesce(m0.sender_user_id, su.id, inf.uid) AS uid, (inf.uid IS NOT NULL) AS inferred,');
  d := replace(d, 'WHEN coalesce(m0.sender_user_id, su.id) IS NOT NULL', 'WHEN coalesce(m0.sender_user_id, su.id, inf.uid) IS NOT NULL');
  d := replace(d, E'FROM m0 LEFT JOIN su ON su.key = m0.sig\n', E'FROM m0 LEFT JOIN su ON su.key = m0.sig\n    LEFT JOIN LATERAL (SELECT public.zapp_infer_sender(m0.cid, m0.sent_at) AS uid WHERE m0.sender_user_id IS NULL AND su.id IS NULL AND NOT m0.from_history AND coalesce(m0.sender_name,'''') NOT ILIKE ''canal%'' AND coalesce(m0.sender_name,'''') NOT ILIKE ''%automa%'' AND m0.sig IS NULL AND m0.sent_at >= (_from - interval ''48 hours'')) inf ON true\n');
  d := replace(d, 'count(*) AS sent, max(m1.sent_at) AS last_sent', 'count(*) AS sent, max(m1.sent_at) AS last_sent, count(*) FILTER (WHERE m1.inferred) AS inferred_sent');
  d := replace(d, '''sent'', a.sent,', '''sent'', a.sent, ''inferred_sent'', a.inferred_sent,');
  IF position('inferred_sent'', a.' in d) = 0 OR position('LATERAL' in d) = 0 THEN RAISE EXCEPTION 'agent patch failed'; END IF;
  EXECUTE d;
END
$do$;