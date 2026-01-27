
# Plano: Corrigir Duplicação de Mensagens ao Editar

## Problema Identificado

Quando o usuário edita uma mensagem no RoyZapp:

1. O frontend atualiza a mensagem no banco com `is_edited: true`
2. O UAZAPI envia um webhook de confirmação com a mensagem editada
3. **O webhook recebe um NOVO `external_message_id`** diferente do original
4. A deduplicação falha porque busca pelo novo ID (inexistente)
5. Uma nova mensagem é inserida, causando duplicação

### Evidência do Banco de Dados
```text
Mensagem original: external_id=3EB0C521B208696F4CA328, is_edited=true
Mensagem duplicada: external_id=3EB0C3204672B2EAEC2180, is_edited=false
Mesmo conteúdo, 31 segundos de diferença
```

### Campo não Verificado
Os logs mostram que o UAZAPI envia `msg.edited` no payload, mas o webhook não verifica esse campo.

## Solução

Adicionar detecção de mensagens editadas no webhook e atualizar a mensagem existente em vez de inserir uma nova.

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/uazapi-webhook/index.ts` | Detectar mensagens editadas e pular inserção |

## Alterações Técnicas

### 1. Detectar Campo `edited` no Payload

Após extrair os dados da mensagem (linha ~636), adicionar verificação:

```typescript
// EDITED MESSAGE DETECTION
// UAZAPI sends 'edited' flag when message was edited
const msgAny = msg as Record<string, unknown>;
const isEditedMessage = msgAny.edited === true || 
                        msgAny.messageType === "editedMessage" ||
                        msgAny.messageType === "EditedMessage";

if (isEditedMessage) {
  console.log(`[EDIT] Detected edited message, will update instead of insert`);
}
```

### 2. Para Mensagens Editadas: Buscar e Atualizar Existente

Modificar a lógica de inserção (após linha ~1220) para:

```typescript
if (isEditedMessage && direction === "outbound") {
  // For edited messages, find the original by matching:
  // 1. Same conversation
  // 2. Same content (after edit, content is already the new value)
  // 3. Outbound direction
  // 4. Recent time window (within 15 minutes, since user could edit old messages)
  // 5. Already marked as is_edited=true (edited by frontend first)
  
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { data: editedOriginal } = await supabase
    .from("zapp_messages")
    .select("id, content, external_message_id")
    .eq("zapp_conversation_id", zappConversationId)
    .eq("direction", "outbound")
    .eq("content", content)
    .eq("is_edited", true)
    .is("external_message_id", null) // If webhook updates before frontend saved external_id
    .or(`external_message_id.neq.${messageId}`) // Or has different external_id
    .gte("created_at", fifteenMinutesAgo)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (editedOriginal) {
    console.log(`[EDIT] Found original edited message ${editedOriginal.id}, skipping duplicate insert`);
    
    // Optionally update the external_message_id to the new one from UAZAPI
    if (editedOriginal.external_message_id !== messageId) {
      await supabase
        .from("zapp_messages")
        .update({ 
          external_message_id: messageId,
          updated_at: new Date().toISOString()
        })
        .eq("id", editedOriginal.id);
      console.log(`[EDIT] Updated external_message_id to ${messageId}`);
    }
    
    skipInsert = true;
  }
}
```

### 3. Adicionar Fallback por Conteúdo Similar

Para mensagens editadas onde o frontend ainda não atualizou, buscar por conteúdo similar:

```typescript
// Additional check: Look for outbound messages with same content 
// that were created/updated recently (prevents duplicate from edit confirmation)
if (!skipInsert && direction === "outbound" && !isEditedMessage) {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  const { data: recentSameContent } = await supabase
    .from("zapp_messages")
    .select("id, external_message_id, is_edited")
    .eq("zapp_conversation_id", zappConversationId)
    .eq("direction", "outbound")
    .eq("content", content)
    .gte("created_at", twoMinutesAgo)
    .neq("external_message_id", messageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (recentSameContent) {
    console.log(`[DEDUPE] Found recent message with same content: ${recentSameContent.id}, ` +
                `is_edited: ${recentSameContent.is_edited}, skipping insert`);
    skipInsert = true;
  }
}
```

## Fluxo Corrigido

```text
1. Usuário edita mensagem no frontend
   → UPDATE zapp_messages SET content=X, is_edited=true

2. UAZAPI confirma edição via webhook
   → msg.edited = true, novo external_message_id
   → Webhook detecta edited=true
   → Busca mensagem com mesmo conteúdo + is_edited=true
   → Encontra original
   → skipInsert = true (não duplica)
   → Opcionalmente atualiza external_message_id

3. Resultado: apenas uma mensagem com conteúdo atualizado
```

## Resultado Esperado

- Mensagens editadas não serão mais duplicadas
- O campo `is_edited` será respeitado
- O `external_message_id` será atualizado para o novo valor do UAZAPI (opcional)
- Logs claros indicando quando uma mensagem editada foi detectada e tratada
