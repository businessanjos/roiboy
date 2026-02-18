

## Corrigir campo de resposta (reply) no uazapi-manager

### Problema

A API UAZAPI espera o campo `replyid` para vincular uma resposta a uma mensagem original, mas o codigo atual envia `quotedMsgId` em todos os endpoints de envio. Isso faz com que as respostas nao sejam vinculadas corretamente no WhatsApp.

### Correcao

Trocar `quotedMsgId` por `replyid` em 4 pontos do arquivo `supabase/functions/uazapi-manager/index.ts`:

| Linha | Endpoint | De | Para |
|-------|----------|----|------|
| 129 | send_text | `textBody.quotedMsgId = ...` | `textBody.replyid = ...` |
| 147 | send_media | `mediaBody.quotedMsgId = ...` | `mediaBody.replyid = ...` |
| 157 | send_to_group | `groupBody.quotedMsgId = ...` | `groupBody.replyid = ...` |
| 172 | send_media_to_group | `mediaBody.quotedMsgId = ...` | `mediaBody.replyid = ...` |

### Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/uazapi-manager/index.ts` | Renomear `quotedMsgId` para `replyid` nas 4 ocorrencias |

