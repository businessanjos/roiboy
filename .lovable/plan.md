
# Plano: Corrigir Duplicação de Documentos no Envio

## Problema Identificado

Quando você envia **um único documento**, aparecem **dois documentos** na conversa:
1. O documento correto (com nome original ex: "Contrato.pdf")
2. Um documento duplicado (com código numérico como nome)

### Causa Raiz

O fluxo atual de envio de documentos:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (RoyZapp.tsx)                                                      │
│ 1. Salva mensagem no banco com:                                             │
│    • content: "Contrato.pdf" (nome do arquivo)                              │
│    • media_filename: "Contrato.pdf"                                         │
│    • external_message_id: NULL (ainda não tem)                              │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ UAZAPI-MANAGER                                                              │
│ 2. Envia documento para WhatsApp via API                                    │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ WEBHOOK (uazapi-webhook)                                                    │
│ 3. Recebe confirmação do WhatsApp com:                                      │
│    • content: "" (caption vazio!)                                           │
│    • media_filename: "123456789" (código do WhatsApp)                       │
│    • external_message_id: "ABC123XYZ"                                       │
│                                                                             │
│ 4. Tenta deduplificar buscando:                                             │
│    WHERE content = "" AND external_message_id IS NULL                       │
│                                                                             │
│    ❌ NÃO ENCONTRA porque frontend salvou content = "Contrato.pdf"          │
│                                                                             │
│ 5. INSERE NOVA MENSAGEM → DUPLICAÇÃO!                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Por que funciona para Áudio?

O webhook já tem lógica especial para áudio:

```typescript
if (mediaType === "audio") {
  // Busca por message_type, não por content
  const { data } = await supabase
    .from("zapp_messages")
    .select("id, media_url")
    .eq("message_type", "audio")  // ← ESPECÍFICO PARA ÁUDIO
    .is("external_message_id", null)
    ...
}
```

**Documentos não têm essa lógica específica!**

## Solução

Adicionar deduplicação específica para documentos no webhook, usando `message_type` e `media_filename` ao invés de apenas `content`.

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-webhook/index.ts` | Adicionar lógica de deduplicação para documentos |

### Mudança no Webhook (linhas ~1380-1415)

```typescript
// ANTES - só trata áudio especialmente
if (mediaType === "audio") {
  // Busca por message_type
} else {
  // Para TODOS outros (texto, imagem, documento), busca por content
  const { data } = await supabase
    .from("zapp_messages")
    .select("id")
    .eq("content", content)  // ❌ Falha para documentos!
    ...
}

// DEPOIS - trata áudio E documento especialmente
if (mediaType === "audio") {
  // Busca por message_type (mantém código existente)
  ...
} else if (mediaType === "document") {
  // NOVO: Busca por message_type + media_filename
  const { data } = await supabase
    .from("zapp_messages")
    .select("id, media_url, media_filename")
    .eq("zapp_conversation_id", zappConversationId)
    .eq("direction", "outbound")
    .eq("message_type", "document")
    .is("external_message_id", null)
    .gte("created_at", fiveMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  recentDupe = data;
  
  if (recentDupe) {
    console.log(`[DEDUPE] Found pending document message ${recentDupe.id} to update`);
  }
} else {
  // Para texto e imagem, busca por content (mantém código existente)
  ...
}
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (RoyZapp.tsx)                                                      │
│ 1. Salva mensagem com:                                                      │
│    • message_type: "document"                                               │
│    • media_filename: "Contrato.pdf"                                         │
│    • external_message_id: NULL                                              │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ WEBHOOK (uazapi-webhook) - CORRIGIDO                                        │
│ 2. Recebe confirmação e detecta: mediaType = "document"                     │
│                                                                             │
│ 3. Busca mensagem pendente:                                                 │
│    WHERE message_type = "document"                                          │
│      AND external_message_id IS NULL                                        │
│      AND created_at > 5 min ago                                             │
│                                                                             │
│    ✅ ENCONTRA a mensagem do frontend!                                      │
│                                                                             │
│ 4. ATUALIZA external_message_id ao invés de inserir                         │
│    → SEM DUPLICAÇÃO! ✅                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

1. Documento enviado pelo frontend cria 1 mensagem
2. Webhook recebe confirmação e **atualiza** a mensagem existente
3. Apenas **1 documento** aparece na conversa
4. O nome correto do arquivo é preservado

## Impacto

- Mudança apenas no edge function `uazapi-webhook`
- Nenhuma mudança no frontend ou banco de dados
- Correção aplica-se automaticamente para novos envios
- Mensagens duplicadas existentes não são afetadas (precisariam ser removidas manualmente)
