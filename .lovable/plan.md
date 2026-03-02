
## Corrigir envio de mensagens em grupos no ROY zAPP

### Problema identificado

O envio de mensagens em grupos falha porque o edge function `uazapi-manager` usa o campo `groupJid` para enviar mensagens a grupos via a API UAZAPI GO v2. Porem, a API usa o campo `number` para **ambos** os casos (contatos individuais e grupos). O campo `groupJid` nao e reconhecido pela API, fazendo com que a mensagem seja silenciosamente ignorada ou retorne erro.

### Causa raiz

No arquivo `supabase/functions/uazapi-manager/index.ts`:

- **Linha 156** (`send_to_group`): Envia `{ groupJid: jid, text: message }` - campo incorreto
- **Linha 166-169** (`send_media_to_group`): Envia `{ groupJid: jid, type: ..., file: ..., text: ... }` - campo incorreto

A API UAZAPI GO v2 espera `number` contendo o JID do grupo (ex: `120363425290252094@g.us`), exatamente como faz para contatos individuais.

### Correcao

**Arquivo:** `supabase/functions/uazapi-manager/index.ts`

#### Alteracao 1 - send_to_group (linhas 152-160)

Trocar `groupJid` por `number` no body da requisicao:

```typescript
} else if (action === "send_to_group") {
  const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
  
  const groupBody: Record<string, unknown> = { number: jid, text: message };
  if (payload.quoted_message_id) groupBody.replyid = payload.quoted_message_id;
  if (payload.mentions) groupBody.mentions = payload.mentions;
  
  result = await uazapiInstance("/send/text", "POST", token!, groupBody);
```

#### Alteracao 2 - send_media_to_group (linhas 162-175)

Trocar `groupJid` por `number` no body da requisicao de midia:

```typescript
} else if (action === "send_media_to_group") {
  const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
  
  const mediaBody: Record<string, unknown> = { 
    number: jid, 
    type: payload.media_type || "image",
    file: payload.media_url,
    text: payload.caption || ""
  };
  if (payload.quoted_message_id) mediaBody.replyid = payload.quoted_message_id;
  if (payload.file_name) mediaBody.fileName = payload.file_name;
  
  result = await uazapiInstance("/send/media", "POST", token!, mediaBody);
```

### Impacto

- Mensagens de texto em grupos voltarao a ser entregues
- Mensagens de midia (imagens, audio, arquivos) em grupos voltarao a ser entregues
- Nenhuma alteracao necessaria no frontend (RoyZapp.tsx) - o problema e exclusivamente no edge function

### Arquivo afetado

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/uazapi-manager/index.ts` | Trocar `groupJid` por `number` em 2 blocos |
