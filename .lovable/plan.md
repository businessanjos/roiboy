

## Corrigir checks de entrega: salvar external_message_id no envio

### Problema raiz

Os logs confirmam que o backend esta processando os ACKs corretamente -- as mensagens **antigas** (que tem `external_message_id`) estao sendo atualizadas para `delivered` e `read` no banco. Porem, as **mensagens novas** enviadas pelo frontend ficam presas com `delivery_status: sent` porque sao salvas **sem** `external_message_id`.

Fluxo atual:
1. Frontend chama `uazapi-manager` para enviar -> UAZAPI retorna `id: "554388346806:3EB0E3..."` 
2. Frontend salva no `zapp_messages` **sem** `external_message_id` (NULL)
3. Webhook recebe ACK com `MessageIDs: ["3EB0E3..."]` e busca com `ilike` no `external_message_id`
4. Nao encontra nenhuma mensagem (porque o campo e NULL) -> ACK e perdido

### Solucao

**Arquivo: `src/pages/RoyZapp.tsx`**

Na logica de envio de mensagens (send_text e send_media), capturar o `id` retornado pelo `uazapi-manager` e salva-lo como `external_message_id` na insercao do `zapp_messages`.

Mudancas:
1. Capturar `data` da resposta do `uazapi-manager` (em vez de descartar)
2. Extrair o `id` ou `messageid` da resposta
3. Incluir como `external_message_id` no insert do `zapp_messages`
4. Atualizar o state local com o `external_message_id`

Isso se aplica a:
- Envio de texto (linha ~1738)
- Envio de midia (linha ~2240)
- Envio para grupos (se aplicavel)

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/RoyZapp.tsx` | Envio de texto: capturar `data.data.id` da resposta do uazapi-manager e salvar como `external_message_id` |
| `src/pages/RoyZapp.tsx` | Envio de midia: mesma logica acima |
| `src/pages/RoyZapp.tsx` | Atualizar state local com `external_message_id` apos o insert |

### Exemplo da mudanca

Antes:
```text
const { error } = await supabase.functions.invoke("uazapi-manager", { body: payload });
// ... insert sem external_message_id
```

Depois:
```text
const { data: sendResult, error } = await supabase.functions.invoke("uazapi-manager", { body: payload });
const externalId = sendResult?.data?.id || sendResult?.data?.messageid || null;
// ... insert com external_message_id: externalId
```

### O que muda para o usuario

- Mensagens enviadas terao o `external_message_id` preenchido imediatamente
- Os ACKs do UAZAPI conseguirao encontrar a mensagem no banco
- Os checks serao atualizados em tempo real: relogio -> 1 check -> 2 checks cinza -> 2 checks azuis
- Funciona para texto, midia e mensagens em grupos
