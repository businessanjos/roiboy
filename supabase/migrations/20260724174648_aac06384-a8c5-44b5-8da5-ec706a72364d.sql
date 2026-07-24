UPDATE public.zapp_conversations c
SET last_message_at = m.max_sent_at,
    last_message_preview = COALESCE(
      CASE WHEN m.direction = 'outbound'
           THEN 'Você: ' || LEFT(COALESCE(m.content, ''), 80)
           ELSE LEFT(COALESCE(m.content, ''), 100)
      END,
      c.last_message_preview
    )
FROM (
  SELECT DISTINCT ON (zapp_conversation_id)
    zapp_conversation_id,
    sent_at AS max_sent_at,
    direction,
    content
  FROM public.zapp_messages
  WHERE sent_at IS NOT NULL
  ORDER BY zapp_conversation_id, sent_at DESC
) m
WHERE m.zapp_conversation_id = c.id
  AND (c.last_message_at IS NULL OR c.last_message_at < m.max_sent_at);