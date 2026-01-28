# ✅ CONCLUÍDO: Correção de Duplicação de Documentos

## O Que Foi Feito

Adicionada lógica de deduplicação específica para **documentos** no webhook `uazapi-webhook`, similar à que já existia para áudios.

### Mudança Implementada

```typescript
// NOVO: Tratamento específico para documentos
else if (mediaType === "document") {
  const { data } = await supabase
    .from("zapp_messages")
    .select("id, media_url, media_filename")
    .eq("zapp_conversation_id", zappConversationId)
    .eq("direction", "outbound")
    .eq("message_type", "document")
    .is("external_message_id", null)
    .gte("created_at", fiveMinutesAgo)
    .maybeSingle();
  recentDupe = data;
}
```

### Fluxo Corrigido

1. Frontend envia documento → salva mensagem com `external_message_id: NULL`
2. Webhook recebe confirmação → busca por `message_type = "document"` + `external_message_id IS NULL`
3. **ENCONTRA** a mensagem do frontend → **ATUALIZA** ao invés de inserir
4. Resultado: **1 único documento** na conversa ✅

## Arquivo Modificado

- `supabase/functions/uazapi-webhook/index.ts` (linhas 1383-1432)
