-- O upsert de sincronização de histórico usa ON CONFLICT (external_message_id),
-- mas só existia índice único parcial (zapp_conversation_id, external_message_id),
-- que o Postgres não aceita como alvo → erro 42P10 em toda sincronização.

-- 0) Índice para o cascade da FK ai_analysis_queue.message_id (DELETE lento sem ele)
CREATE INDEX IF NOT EXISTS idx_ai_analysis_queue_message_id
  ON public.ai_analysis_queue (message_id);

-- 1) Deduplicar: manter a cópia mais recente de cada external_message_id
--    (duplicatas estavam em conversas diferentes da mesma conta).
DELETE FROM public.zapp_messages m
USING public.zapp_messages newer
WHERE m.external_message_id IS NOT NULL
  AND newer.external_message_id = m.external_message_id
  AND (newer.created_at > m.created_at
       OR (newer.created_at = m.created_at AND newer.id > m.id));

-- 2) Índice único NÃO parcial: índices parciais não podem ser alvo de ON CONFLICT.
CREATE UNIQUE INDEX uq_zapp_messages_external_message_id
  ON public.zapp_messages (external_message_id);

COMMENT ON INDEX public.uq_zapp_messages_external_message_id IS 'Alvo do upsert em sync-uazapi-history-to-zapp (onConflict: external_message_id); NULLs são permitidos';