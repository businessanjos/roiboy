

## Diagnosticar e corrigir checks de entrega de mensagens

### Problema real

Os logs confirmam que **nenhum evento de ACK/status chegou** ao webhook. Isso pode significar:

1. O UAZAPI GO v2 nao esta enviando os eventos `messages.update` apesar da configuracao
2. O evento chega com um `EventType` diferente do esperado e esta sendo descartado silenciosamente pelo filtro de "eventos desconhecidos" (linha 307)

### Causa provavel

Na linha 307-310 do `uazapi-webhook/index.ts`, existe uma lista de eventos permitidos (`handledEvents`). Qualquer evento que nao esteja nessa lista E que nao seja identificado como ACK nas linhas 259-260 e **descartado silenciosamente**. Se o UAZAPI envia o ACK com um nome de evento diferente (ex: `message_ack`, `status`, `MESSAGE_ACK`, `update`, etc.), ele e ignorado sem nenhum log.

### Solucao em 2 etapas

**Etapa 1: Adicionar log de diagnostico (para descobrir o formato real)**

No `uazapi-webhook/index.ts`, adicionar um log logo apos receber o payload (antes de qualquer filtro) que registre o `eventType` de TODOS os eventos recebidos. Isso permitira ver exatamente o que o UAZAPI envia.

```
// Logo apos extrair o eventType (linha 216):
console.log(`[WEBHOOK] Event received: ${eventType}, keys: ${Object.keys(payload).join(",")}`);
```

**Etapa 2: Tornar o ACK handler mais abrangente**

Alem de verificar o `eventType`, verificar tambem se o payload contem campos tipicos de ACK (`ack`, `status`, `update`) independente do nome do evento. Isso garante que o ACK seja processado mesmo que o UAZAPI use um nome de evento inesperado.

### Mudancas tecnicas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/uazapi-webhook/index.ts` | 1. Adicionar log do eventType para todos os payloads recebidos |
| `supabase/functions/uazapi-webhook/index.ts` | 2. Expandir deteccao de ACK: verificar presenca de campo `ack` no payload independente do eventType |
| `supabase/functions/uazapi-webhook/index.ts` | 3. Adicionar log detalhado quando ACK e detectado (messageId, ack value, status resultante) |

### O que muda para o usuario

- Apos o deploy, os logs mostrarao exatamente quais eventos o UAZAPI esta enviando
- Se o ACK estiver chegando com outro nome de evento, sera capturado pela logica expandida
- Os checks passarao a funcionar corretamente (1 check = enviado, 2 = entregue, 2 azuis = lido)
- Caso o UAZAPI nao esteja enviando nenhum evento de status, os logs confirmarao isso e sera necessario verificar a configuracao diretamente no painel do UAZAPI

