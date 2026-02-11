
## Correção: Áudios de clientes não chegam no ROY zAPP

### Diagnóstico

Nos logs do webhook, encontrei esta entrada reveladora:

```
[WEBHOOK] BLOCKED: Inbound message without content/media.
  mediaType: (vazio), mediaUrl: https://mmg.whatsapp.net/...., msgType: media
```

O UAZAPI envia algumas mensagens de áudio (e possivelmente outras mídias) num formato onde `msg.type = "media"` mas **sem** os campos específicos (`audioMessage`, `imageMessage`, etc.). O webhook extrai o `mediaUrl` corretamente (linha 552), mas o `mediaType` permanece vazio porque nenhum branch do `if/else if` é acionado.

Isso causa **dois bloqueios em cascata**:

1. **Linha 802**: `hasMedia = mediaType && (mediaUrl || encryptedMediaUrl)` -- como `mediaType` é vazio, `hasMedia` é `false`
2. **Linha 823**: A mensagem é bloqueada como "sem conteúdo nem mídia"
3. **Linhas 677-678**: `isValidWhatsAppMediaUrl` também exige `mediaType`, então mesmo que passasse do bloqueio, a mídia não seria tratada como válida para download

### Causa raiz

Falta uma lógica de fallback que infira o `mediaType` a partir do `mimetype` ou do `msg.type` quando os campos específicos de mensagem (audioMessage, etc.) não estão presentes.

### Solução

Adicionar um bloco de inferência de `mediaType` logo após toda a extração de conteúdo (depois da linha 659), antes da verificação de bloqueio:

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts`

1. **Inferência de mediaType (após linha 659)**: Se temos `mediaUrl` mas `mediaType` está vazio, inferir o tipo a partir de:
   - `mediaMimetype` (ex: "audio/ogg" -> "audio", "image/jpeg" -> "image")
   - `msg.type` ou `msg.messageType` como fallback (ex: "pttMessage" -> "audio", "media" -> inferir do mimetype)
   - Se nada funcionar mas temos URL de mmg.whatsapp.net, assumir "document" como fallback seguro

2. **Para áudio especificamente**: Detectar tipos PTT ("pttMessage", "ptt") que o UAZAPI usa para notas de voz e mapear para `mediaType = "audio"`

### Detalhes técnicos

Inserir o seguinte bloco entre a linha 659 e a linha 666 do arquivo `supabase/functions/uazapi-webhook/index.ts`:

```typescript
// FALLBACK: Infer mediaType from mimetype or msg.type when specific message fields are absent
if (mediaUrl && !mediaType) {
  if (mediaMimetype) {
    const mimePrefix = mediaMimetype.split("/")[0].toLowerCase();
    if (mimePrefix === "audio") mediaType = "audio";
    else if (mimePrefix === "image") mediaType = "image";
    else if (mimePrefix === "video") mediaType = "video";
    else mediaType = "document";
  } else {
    // Infer from msg.type or messageType
    const rawType = String(msg.type || msg.messageType || msgAny.messageType || "").toLowerCase();
    if (rawType.includes("ptt") || rawType.includes("audio")) {
      mediaType = "audio";
    } else if (rawType.includes("image")) {
      mediaType = "image";
    } else if (rawType.includes("video")) {
      mediaType = "video";
    } else if (rawType.includes("sticker")) {
      mediaType = "sticker";
    } else if (rawType === "media" || mediaUrl.includes("mmg.whatsapp.net")) {
      mediaType = "document"; // safe fallback
    }
  }
  if (mediaType) {
    console.log(`[WEBHOOK] Inferred mediaType="${mediaType}" from mimetype="${mediaMimetype}" / msgType="${msg.type}"`);
  }
}
```

Isso resolve o problema sem alterar nenhuma outra parte do fluxo. As mensagens de áudio que antes eram bloqueadas agora terão `mediaType = "audio"` e passarão normalmente pelo pipeline de processamento e download lazy.
