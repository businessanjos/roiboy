
# Plano: Sincronização de Mensagens Apagadas do WhatsApp no ROY zAPP

## Diagnóstico do Problema

O time de Operações relata que mensagens apagadas pelos clientes no WhatsApp continuam aparecendo normalmente no ROY zAPP. A análise revelou dois problemas:

| Componente | Problema Identificado |
|------------|----------------------|
| Webhook UAZAPI | Extração de ID limitada a formatos simples - não captura arrays em `data.keys` |
| Frontend (useZappData) | Query SQL filtra mensagens deletadas, fazendo-as "desaparecer" ao recarregar |

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                      FLUXO ATUAL (QUEBRADO)                                │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
     Cliente apaga mensagem         │
     no WhatsApp                    ▼
                        ┌─────────────────────────┐
                        │   UAZAPI envia webhook  │
                        │   EventType: messages.  │
                        │   delete ou revoke      │
                        └────────────┬────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         │                                                       │
         ▼                                                       ▼
┌─────────────────────────┐                        ┌─────────────────────────┐
│ Formato 1: { id: "..." }│                        │ Formato 2 (NÃO CAPTURADO│
│                         │                        │ { data: { keys: [...] } │
│ ✓ Capturado             │                        │                         │
│                         │                        │ ✗ ID não encontrado     │
└─────────────────────────┘                        └─────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   Mesmo quando atualiza │
                        │   is_deleted = true     │
                        │                         │
                        │   ✗ Frontend filtra a   │
                        │   mensagem na próxima   │
                        │   vez que carrega       │
                        └─────────────────────────┘
```

---

## Solução Proposta

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                      FLUXO CORRIGIDO                                       │
└────────────────────────────────────────────────────────────────────────────┘

     Cliente apaga mensagem                    
     no WhatsApp                               
                        ┌─────────────────────────┐
                        │   UAZAPI envia webhook  │
                        └────────────┬────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   Webhook processa      │
                        │   TODOS os formatos:    │
                        │   • msg.id              │
                        │   • msg.key.id          │
                        │   • data.keys[]         │ ← NOVO
                        │   • data.messages[]     │ ← NOVO
                        │   • message.messageid   │ ← NOVO
                        └────────────┬────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   UPDATE zapp_messages  │
                        │   SET is_deleted = true │
                        └────────────┬────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         │                                                       │
         ▼                                                       ▼
┌─────────────────────────┐                        ┌─────────────────────────┐
│  Realtime UPDATE        │                        │  Próximo fetchMessages  │
│                         │                        │                         │
│  → Atualiza na UI       │                        │  → INCLUI mensagens     │
│    instantaneamente     │                        │    com is_deleted=true  │
│                         │                        │    (sem filtrar)        │
│  → Mostra placeholder   │                        │  → Mostra placeholder   │
│    "🚫 Mensagem apagada"│                        │    "🚫 Mensagem apagada"│
└─────────────────────────┘                        └─────────────────────────┘
```

---

## Etapa 1: Expandir Extração de ID no Webhook

O código atual tenta apenas alguns caminhos simples. Precisamos adicionar suporte para formatos de array:

```typescript
// ANTES (limitado):
let deletedMessageId = msg?.id || msg?.key?.id || msg?.messageId || payloadAny?.key?.id;

// DEPOIS (completo):
// 1. Tentar formatos simples
let deletedMessageId = msg?.id || msg?.key?.id || msg?.messageId || 
                       payloadAny?.key?.id || msg?.messageid;

// 2. Tentar formato com array em data.keys (Evolution API style)
if (!deletedMessageId && payloadAny.data?.keys) {
  const keys = payloadAny.data.keys;
  if (Array.isArray(keys) && keys.length > 0) {
    deletedMessageId = keys[0].id;
    // Processar múltiplas deleções se necessário
    for (const key of keys) {
      if (key.id) {
        await markMessageAsDeleted(supabase, accountId, key.id);
      }
    }
  }
}

// 3. Tentar formato com array em data.messages
if (!deletedMessageId && payloadAny.data?.messages) {
  const messages = payloadAny.data.messages;
  if (Array.isArray(messages)) {
    for (const m of messages) {
      const msgId = m.key?.id || m.id || m.messageId;
      if (msgId) {
        await markMessageAsDeleted(supabase, accountId, msgId);
      }
    }
    deletedMessageId = "processed_array"; // Flag para saber que processamos
  }
}

// 4. Tentar buscar por ID parcial (formato "phone:msgId")
// O webhook pode enviar apenas "msgId" mas no DB temos "phone:msgId"
```

### Melhorar Busca por ID

Quando o UAZAPI envia apenas o ID parcial (sem o prefixo do telefone), a busca atual falha. Precisamos buscar também por substring:

```typescript
// Tentar busca exata primeiro
let updateQuery = supabase
  .from("zapp_messages")
  .update({ is_deleted: true, deleted_at: new Date().toISOString() })
  .eq("account_id", accountId)
  .eq("external_message_id", deletedMessageId);

const { count } = await updateQuery;

// Se não encontrou, tentar busca parcial (ID termina com o valor enviado)
if (!count || count === 0) {
  const { error, count: partialCount } = await supabase
    .from("zapp_messages")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .ilike("external_message_id", `%${deletedMessageId}`);
    
  console.log(`Partial match update affected ${partialCount} rows`);
}
```

---

## Etapa 2: Remover Filtro de Mensagens Deletadas no Frontend

O hook `useZappData.tsx` está filtrando mensagens deletadas, impedindo que apareçam com o placeholder:

```typescript
// ANTES (linha 560 de useZappData.tsx):
.or("is_deleted.is.null,is_deleted.eq.false")

// DEPOIS:
// Remover este filtro completamente!
// A query deve retornar TODAS as mensagens, incluindo deletadas
// O ZappMessageBubble já cuida de mostrar o placeholder adequado
```

---

## Etapa 3: Garantir Atualização em Tempo Real

O listener de Realtime já existe e funciona (`RoyZapp.tsx:682-690`), mas precisamos confirmar que está escutando eventos UPDATE:

```typescript
// Já existe, apenas verificar:
.on(
  'postgres_changes',
  { 
    event: 'UPDATE', // ← Deve capturar quando is_deleted muda
    schema: 'public',
    table: 'zapp_messages',
    filter: `zapp_conversation_id=eq.${conversationId}`
  },
  (payload) => {
    const updatedMsg = payload.new;
    setMessages(prev => prev.map(m => 
      m.id === updatedMsg.id 
        ? { ...m, ...updatedMsg } // Isso inclui is_deleted: true
        : m
    ));
  }
)
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/uazapi-webhook/index.ts` | Expandir extração de ID de mensagem para suportar formatos de array e busca parcial |
| `src/hooks/useZappData.tsx` | Remover filtro `.or("is_deleted.is.null,is_deleted.eq.false")` |

---

## Detalhes Técnicos

### Formatos de Payload Suportados (Após Correção)

```typescript
// Formato 1: Simples
{ message: { id: "MSG_ID" } }

// Formato 2: Com key
{ message: { key: { id: "MSG_ID" } } }
{ data: { id: "MSG_ID" } }
{ key: { id: "MSG_ID" } }

// Formato 3: Array de keys (Evolution API / WASender)
{ data: { keys: [{ id: "MSG_ID", fromMe: false, remoteJid: "..." }] } }

// Formato 4: Array de messages
{ data: { messages: [{ key: { id: "MSG_ID" }, ... }] } }

// Formato 5: ID no root
{ id: "MSG_ID" }
{ messageId: "MSG_ID" }
{ messageid: "MSG_ID" }
```

### Matching de IDs

O sistema armazena `external_message_id` em formatos como:
- `"554388346806:3EB0A21FD5E7E7DF84A6F7"` (phone:msgId)
- `"3EB0A21FD5E7E7DF84A6F7"` (apenas msgId)

A busca deve suportar ambos via:
1. Busca exata: `.eq("external_message_id", deletedMessageId)`
2. Busca parcial: `.ilike("external_message_id", `%${deletedMessageId}`)`

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Cliente apaga mensagem | Mensagem permanece visível | Exibe "🚫 Mensagem apagada" em tempo real |
| Recarregar página após deleção | Mensagem desaparece completamente | Exibe "🚫 Mensagem apagada" corretamente |
| Webhook com formato de array | Não capturado, mensagem fica | Capturado e sincronizado |
| ID parcial enviado | Não encontra no DB | Busca parcial encontra |

---

## Testes Sugeridos

1. Simular deleção de mensagem enviada por cliente no WhatsApp
2. Verificar nos logs do webhook se o ID foi extraído corretamente
3. Verificar se a mensagem aparece como "🚫 Mensagem apagada" na conversa
4. Recarregar a página e confirmar que o placeholder permanece visível
