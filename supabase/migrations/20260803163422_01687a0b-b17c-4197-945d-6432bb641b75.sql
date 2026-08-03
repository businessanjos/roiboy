DO $$
DECLARE
  d record;
  v_target uuid;
BEGIN
  FOR d IN
    SELECT id, account_id, integration_id,
           regexp_replace(coalesce(phone_e164,''),'\D','','g') AS digits
    FROM public.zapp_conversations
    WHERE created_at > now() - interval '1 day'
      AND length(regexp_replace(coalesce(phone_e164,''),'\D','','g')) BETWEEN 8 AND 11
  LOOP
    SELECT c.id INTO v_target
    FROM public.zapp_conversations c
    LEFT JOIN public.zapp_messages m ON m.zapp_conversation_id = c.id
    WHERE c.account_id = d.account_id
      AND c.integration_id = d.integration_id
      AND c.id <> d.id
      AND regexp_replace(coalesce(c.phone_e164,''),'\D','','g') LIKE d.digits || '%'
    GROUP BY c.id
    ORDER BY count(m.id) DESC, max(m.created_at) DESC NULLS LAST
    LIMIT 1;

    IF v_target IS NULL THEN CONTINUE; END IF;

    UPDATE public.zapp_messages
    SET zapp_conversation_id = v_target
    WHERE zapp_conversation_id = d.id
      AND (external_message_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.zapp_messages x
        WHERE x.zapp_conversation_id = v_target
          AND x.external_message_id = public.zapp_messages.external_message_id
      ));

    DELETE FROM public.zapp_messages WHERE zapp_conversation_id = d.id;
    DELETE FROM public.zapp_conversation_assignments WHERE zapp_conversation_id = d.id;
    DELETE FROM public.zapp_conversations WHERE id = d.id;

    UPDATE public.zapp_conversations c
    SET last_message_at = sub.last_at,
        last_message_preview = sub.preview
    FROM (
      SELECT m.created_at AS last_at, left(coalesce(m.content, m.transcription, ''), 120) AS preview
      FROM public.zapp_messages m
      WHERE m.zapp_conversation_id = v_target
      ORDER BY m.created_at DESC LIMIT 1
    ) sub
    WHERE c.id = v_target;
  END LOOP;
END $$;