

## Blindar a funcionalidade de delivery status (checks) do WhatsApp

### O que sera feito

Criar uma memoria arquitetural detalhada que documenta os componentes criticos do sistema de delivery status (ACK/checks) para que futuras alteracoes no codigo nunca quebrem essa funcionalidade.

### Componentes criticos a proteger

**1. Backend: `supabase/functions/uazapi-webhook/index.ts` (linhas 262-388)**
- Deteccao de ACK por nome de evento: inclui `messages_update`, `messages.update`, `message_ack`, etc.
- Deteccao de ACK por conteudo do payload: campo `ack`, array `event`, objeto `event` com `MessageIDs`
- Formato UAZAPI GO v2: `event` e um OBJETO (nao array) com `MessageIDs: string[]` e `Type: "Delivered"|"Read"|"Sent"`
- Mapeamento de status: `"Read"` -> ack 4, `"Delivered"` -> ack 3, `"Sent"` -> ack 2
- Query com `ilike("%messageId")` porque o banco armazena `owner:messageId` mas o UAZAPI envia apenas `messageId`

**2. Frontend: `src/pages/RoyZapp.tsx`**
- Envio de texto: captura `sendResult.data.id` e salva como `external_message_id` no insert do `zapp_messages`
- Envio de midia: captura `data.data.id` e salva como `external_message_id`
- Envio de audio: atualiza o registro com `external_message_id` apos o envio
- Envio de contato: captura `contactSendResult.data.id` e salva como `external_message_id`

**3. Kill switch: `FUNCTION_DISABLED = false` (linha 198)**
- Deve permanecer `false` para que os ACKs sejam processados
- Se ativado, os checks param de funcionar

### Regras de protecao

1. **NUNCA** remover a deteccao de `hasEventObject` (objeto com `MessageIDs`)
2. **NUNCA** remover o mapeamento de strings (`"Read"`, `"Delivered"`) para numeros
3. **NUNCA** trocar `ilike` por `eq` na query de ACK -- o match parcial e essencial
4. **NUNCA** remover a captura de `external_message_id` no envio de mensagens (texto, midia, audio, contato)
5. **NUNCA** ativar `FUNCTION_DISABLED = true` sem saber que isso desativa os checks
6. **NUNCA** remover `messages_update` da lista de eventos ACK detectados

### Implementacao

Atualizar a memoria `features/roy-zapp/message-delivery-reliability-unified` com todos os detalhes tecnicos acima para servir como referencia permanente.

