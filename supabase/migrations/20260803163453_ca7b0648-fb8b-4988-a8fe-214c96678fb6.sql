UPDATE public.zapp_messages m
SET zapp_conversation_id = '8eb774c8-9617-4b70-90a7-1cf36d510640'
WHERE m.zapp_conversation_id = '9e80670b-f168-4beb-9913-acd9fafc2cff'
  AND (m.external_message_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.zapp_messages x
    WHERE x.zapp_conversation_id = '8eb774c8-9617-4b70-90a7-1cf36d510640'
      AND x.external_message_id = m.external_message_id));

DELETE FROM public.zapp_messages WHERE zapp_conversation_id = '9e80670b-f168-4beb-9913-acd9fafc2cff';
DELETE FROM public.zapp_conversation_assignments WHERE zapp_conversation_id = '9e80670b-f168-4beb-9913-acd9fafc2cff';
DELETE FROM public.zapp_conversations WHERE id = '9e80670b-f168-4beb-9913-acd9fafc2cff';

UPDATE public.zapp_conversations c
SET last_message_at = s.created_at,
    last_message_preview = left(coalesce(s.content, s.transcription, ''), 120)
FROM (SELECT created_at, content, transcription FROM public.zapp_messages
      WHERE zapp_conversation_id = '8eb774c8-9617-4b70-90a7-1cf36d510640'
      ORDER BY created_at DESC LIMIT 1) s
WHERE c.id = '8eb774c8-9617-4b70-90a7-1cf36d510640';