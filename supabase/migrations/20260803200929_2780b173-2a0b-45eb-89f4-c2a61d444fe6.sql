DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT s.id AS sid, t.id AS tid
    FROM public.zapp_conversations s
    JOIN public.zapp_conversations t
      ON t.account_id = s.account_id
     AND t.integration_id IS NOT DISTINCT FROM s.integration_id
     AND t.is_group = false
     AND t.id <> s.id
     AND regexp_replace(t.phone_e164, '\D', '', 'g') = regexp_replace(s.external_thread_id, '\D', '', 'g')
    WHERE s.is_group = false
      AND length(regexp_replace(s.phone_e164, '\D', '', 'g')) BETWEEN 8 AND 11
  LOOP
    DELETE FROM public.zapp_messages m
     WHERE m.zapp_conversation_id = r.sid
       AND m.external_message_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.zapp_messages x
          WHERE x.zapp_conversation_id = r.tid
            AND x.external_message_id = m.external_message_id
       );

    UPDATE public.zapp_messages SET zapp_conversation_id = r.tid WHERE zapp_conversation_id = r.sid;
    UPDATE public.zapp_calls SET zapp_conversation_id = r.tid WHERE zapp_conversation_id = r.sid;
    UPDATE public.zapp_client_suggestions SET zapp_conversation_id = r.tid WHERE zapp_conversation_id = r.sid;
    UPDATE public.zapp_audit_logs SET zapp_conversation_id = r.tid WHERE zapp_conversation_id = r.sid;
    UPDATE public.zapp_transfers SET conversation_id = r.tid WHERE conversation_id = r.sid;
    UPDATE public.zapp_routing_audit_log SET conversation_id = r.tid WHERE conversation_id = r.sid;
    UPDATE public.ai_suggestion_feedback SET conversation_id = r.tid WHERE conversation_id = r.sid;
    UPDATE public.ai_effective_patterns SET source_conversation_id = r.tid WHERE source_conversation_id = r.sid;
    UPDATE public.message_events SET conversation_id = r.tid WHERE conversation_id = r.sid;

    DELETE FROM public.zapp_conversation_assignments WHERE zapp_conversation_id = r.sid;
    DELETE FROM public.zapp_conversations WHERE id = r.sid;

    UPDATE public.zapp_conversations c
       SET last_message_at = gm.mx,
           last_message_preview = left(coalesce(gm.prev, c.last_message_preview), 100)
      FROM (
        SELECT max(created_at) AS mx,
               (array_agg(coalesce(content, '') ORDER BY created_at DESC))[1] AS prev
          FROM public.zapp_messages WHERE zapp_conversation_id = r.tid
      ) gm
     WHERE c.id = r.tid AND gm.mx IS NOT NULL;
  END LOOP;
END $$;