UPDATE public.zapp_messages m
SET quoted_content = COALESCE(
  orig.content,
  CASE orig.message_type
    WHEN 'image' THEN '📷 Imagem'
    WHEN 'video' THEN '🎬 Vídeo'
    WHEN 'audio' THEN '🎤 Áudio'
    WHEN 'document' THEN '📄 Documento'
    WHEN 'sticker' THEN '🎨 Figurinha'
    ELSE NULL
  END
),
quoted_sender_name = COALESCE(
  m.quoted_sender_name,
  orig.sender_name,
  CASE orig.direction WHEN 'inbound' THEN 'Cliente' ELSE 'Você' END
)
FROM public.zapp_messages orig
WHERE m.quoted_message_id IS NOT NULL
  AND m.quoted_content IS NULL
  AND orig.external_message_id = m.quoted_message_id;