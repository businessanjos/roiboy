
## Corrigir recebimento de eventos de exclusao de mensagens pelo cliente

### Problema

Quando o cliente apaga uma mensagem no WhatsApp ("apagar para todos"), o ROY zAPP nao reflete a exclusao porque o webhook nao esta inscrito no evento `messages.delete`. 

A configuracao atual do webhook (action `configure_webhook` no `uazapi-manager`) registra apenas:
```
["messages", "messages.update", "connection", "groups", "qrcode"]
```

O evento `messages.delete` nao esta na lista, entao a UAZAPI nunca envia o payload de exclusao para o nosso webhook. O handler no `uazapi-webhook` ja existe e funciona — ele so nunca e acionado.

### Solucao

Adicionar `"messages.delete"` a lista de eventos do webhook no `uazapi-manager`.

### Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/uazapi-manager/index.ts` | Adicionar `"messages.delete"` ao array `events` na configuracao do webhook (linha 264) |

### Detalhes tecnicos

**Linha 264 do uazapi-manager/index.ts** — alterar de:
```typescript
events: ["messages", "messages.update", "connection", "groups", "qrcode"]
```
Para:
```typescript
events: ["messages", "messages.update", "messages.delete", "connection", "groups", "qrcode"]
```

Apos essa mudanca, os usuarios precisarao clicar em **"Configurar Webhook"** novamente nas instancias ativas para que a nova lista de eventos seja aplicada na UAZAPI. Instancias configuradas antes dessa correcao continuarao sem receber eventos de delete ate serem reconfiguradas.

### Por que isso resolve

1. A UAZAPI passa a enviar eventos `messages.delete` para o nosso webhook
2. O `uazapi-webhook` ja possui o handler completo (linhas 1912-2032) que marca `is_deleted = true` no banco
3. O frontend (`ZappMessageBubble`) ja exibe "Mensagem apagada" quando `is_deleted === true`
4. A cadeia inteira ja existe — so faltava o gatilho inicial
