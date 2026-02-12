

## Corrigir extração de ACK para o formato real do UAZAPI GO v2

### Problema encontrado nos logs

O código atual espera `event` como um **array** com campos `id` e `status`, mas o UAZAPI GO v2 envia `event` como um **objeto** com esta estrutura:

```text
{
  "EventType": "messages_update",
  "event": {
    "MessageIDs": ["3EB038719B72377701266F"],
    "Type": "Delivered" | "Read",
    "IsFromMe": false,
    "Chat": "5531...@s.whatsapp.net"
  },
  "state": "Delivered" | "Read",
  "type": "ReadReceipt"
}
```

Tres problemas especificos:
1. `event` e um objeto, nao um array -- `Array.isArray(event)` retorna `false`
2. O message ID esta em `event.MessageIDs[0]`, nao em `event.id`
3. O status e uma string em `event.Type` ou `state` ("Delivered"/"Read"), nao um numero `ack`

### Solucao

**Arquivo: `supabase/functions/uazapi-webhook/index.ts`**

Adicionar deteccao do formato objeto em `event`:

1. Apos checar `Array.isArray(eventArray)`, adicionar verificacao se `event` e um objeto com campo `MessageIDs`
2. Extrair `messageId` de `event.MessageIDs[0]`
3. Mapear strings de status para valores numericos de ACK:
   - `"Delivered"` -> ack 3 (entregue, 2 checks cinza)
   - `"Read"` -> ack 4 (lido, 2 checks azuis)
   - `"Sent"` -> ack 2 (enviado, 1 check)
4. Tambem verificar o campo `state` do payload raiz como fallback
5. O message ID no UAZAPI nao inclui o prefixo do owner -- ajustar a query para buscar com `LIKE` ou `ilike` usando o sufixo do ID

### Mudanca no match do banco

O `external_message_id` salvo no banco tem formato `554388346806:3EB038719B72377701266F` (owner:messageId), mas o UAZAPI envia apenas `3EB038719B72377701266F` no `MessageIDs`. A query precisa usar `.ilike("external_message_id", `%${messageId}`)` para encontrar o match.

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/uazapi-webhook/index.ts` | Adicionar deteccao de `event` como objeto (nao apenas array) |
| `supabase/functions/uazapi-webhook/index.ts` | Extrair messageId de `event.MessageIDs[0]` |
| `supabase/functions/uazapi-webhook/index.ts` | Mapear `event.Type` / `state` strings para ack numerico |
| `supabase/functions/uazapi-webhook/index.ts` | Usar query com `ilike` para match parcial do external_message_id |

### O que muda para o usuario

- Mensagens enviadas mostrarao 2 checks cinza quando entregues
- Mensagens lidas mostrarao 2 checks azuis
- O processamento sera automatico sem necessidade de configuracao adicional
