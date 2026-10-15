CREATE UNIQUE INDEX IF NOT EXISTS uq_zapp_messages_conv_external_message_id
  ON public.zapp_messages (zapp_conversation_id, external_message_id);
DROP INDEX IF EXISTS public.uq_zapp_messages_external_message_id;
COMMENT ON INDEX public.uq_zapp_messages_conv_external_message_id IS 'Alvo do upsert em sync-uazapi-history-to-zapp; a mesma mensagem pode existir em conversas de setores diferentes';