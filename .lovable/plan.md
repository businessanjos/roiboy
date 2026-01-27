
# Plano: Implementar Exibição de Mensagens Citadas (Reply) no ROY zAPP

## Problema Identificado

Quando um cliente responde a uma mensagem específica no WhatsApp, a referência à mensagem original (quoted message) não está sendo exibida no ROY zAPP. A mensagem aparece "solta" sem contexto, causando confusão para os operadores.

### Exemplo do Print
- **WhatsApp**: Mostra "Canal Atendimento Anjos" com imagem e texto, e a resposta "Esse ?" referenciando essa mensagem
- **ROY zAPP**: Mostra apenas "Esse ?" sem referência à mensagem original

### Causa Raiz Identificada

O webhook do UAZAPI está procurando os dados de mensagem citada nos campos errados:
- O código atual procura por: `quotedMsg`, `contextInfo`, `quotedMessageId`
- O UAZAPI envia como: `quoted` (campo separado no objeto message)

Evidência dos logs:
```
Message object keys: [
  "quoted",           // <-- Este é o campo correto!
  "quotedMessageId",  // Isso também existe
  "content",
  ...
]
```

### Estado Atual
- A tabela `zapp_messages` JÁ possui os campos: `quoted_message_id`, `quoted_content`, `quoted_sender_name`
- O frontend (`ZappMessageBubble`) JÁ renderiza mensagens citadas quando `quoted_content` existe
- O problema é 100% na extração de dados no webhook

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/uazapi-webhook/index.ts` | Adicionar extração do campo `quoted` do UAZAPI |

## Alteração Técnica

### Atualizar Extração de Quoted Message (linhas 656-702)

**Problema**: O código não lê o campo `quoted` que o UAZAPI envia.

**Solução**: Adicionar `msgAnyQuote.quoted` como uma das fontes de dados:

```typescript
// ============================================
// EXTRACT QUOTED MESSAGE DATA (for replies)
// ============================================
const msgAnyQuote = msg as Record<string, unknown>;

// UAZAPI sends quoted message data in multiple formats:
// 1. msg.quoted - Object with body/text/caption + sender info
// 2. msg.contextInfo - Standard WhatsApp format
// 3. msg.extendedTextMessage?.contextInfo
// 4. msg.quotedMsg - Alternative format
const contextInfo = msg.contextInfo || 
                    msg.extendedTextMessage?.contextInfo || 
                    (msgAnyQuote.contextInfo as Record<string, unknown>);

// CRITICAL FIX: UAZAPI uses 'quoted' field for quoted messages
const uazapiQuoted = msgAnyQuote.quoted as Record<string, unknown>;
const quotedMsg = uazapiQuoted || 
                  (msgAnyQuote.quotedMsg as Record<string, unknown>) || 
                  (contextInfo?.quotedMessage as Record<string, unknown>);

// Extract quoted message ID from multiple sources
const quotedMsgId = msg.quotedMessageId || 
                    (uazapiQuoted?.id as string) ||
                    (uazapiQuoted?.messageid as string) ||
                    (contextInfo?.stanzaId as string) || 
                    null;

// Extract quoted content from various formats (UAZAPI sends in different ways)
let quotedContent: string | null = null;
if (quotedMsg) {
  // UAZAPI format: quoted.body, quoted.text, quoted.caption
  quotedContent = 
    (quotedMsg.body as string) ||  // UAZAPI primary field
    (quotedMsg.text as string) ||  // Alternative text field
    (quotedMsg.caption as string) ||  // For media with captions
    (quotedMsg.conversation as string) ||  // Standard WhatsApp
    ((quotedMsg.extendedTextMessage as Record<string, unknown>)?.text as string) ||
    ((quotedMsg.imageMessage as Record<string, unknown>)?.caption as string) ||
    ((quotedMsg.videoMessage as Record<string, unknown>)?.caption as string) ||
    ((quotedMsg.documentMessage as Record<string, unknown>)?.caption as string) ||
    null;
  
  // If still no content and it's media, show placeholder
  if (!quotedContent) {
    // Check UAZAPI format (quoted.type or quoted.mediaType)
    const quotedType = (quotedMsg.type as string) || (quotedMsg.mediaType as string) || "";
    
    if (quotedType.toLowerCase().includes("image") || quotedMsg.imageMessage) {
      quotedContent = "📷 Imagem";
    } else if (quotedType.toLowerCase().includes("video") || quotedMsg.videoMessage) {
      quotedContent = "🎬 Vídeo";
    } else if (quotedType.toLowerCase().includes("audio") || quotedType.toLowerCase().includes("ptt") || quotedMsg.audioMessage) {
      quotedContent = "🎤 Áudio";
    } else if (quotedType.toLowerCase().includes("document") || quotedMsg.documentMessage) {
      quotedContent = "📄 Documento";
    } else if (quotedType.toLowerCase().includes("sticker") || quotedMsg.stickerMessage) {
      quotedContent = "🎨 Figurinha";
    }
  }
}

// Extract quoted sender name
// UAZAPI format: quoted.sender, quoted.senderName, quoted.sender_pn
const quotedParticipant = (uazapiQuoted?.sender as string) ||
                          (uazapiQuoted?.sender_pn as string) ||
                          (contextInfo?.participant as string);
                          
let quotedSenderName: string | null = null;

// First try senderName from UAZAPI (the actual display name)
if (uazapiQuoted?.senderName && typeof uazapiQuoted.senderName === "string") {
  quotedSenderName = uazapiQuoted.senderName;
} else if (quotedParticipant) {
  // Fallback: extract from phone/JID
  quotedSenderName = quotedParticipant.split("@")[0];
  if (quotedSenderName && /^\d+$/.test(quotedSenderName)) {
    quotedSenderName = `+${quotedSenderName}`;
  }
}

// For outbound quoted messages, show "Você" instead of phone
if (uazapiQuoted?.fromMe === true) {
  quotedSenderName = "Você";
}

if (quotedMsgId || quotedContent) {
  console.log(`Quoted message detected - ID: ${quotedMsgId}, content: ${quotedContent?.substring(0, 50)}..., sender: ${quotedSenderName}`);
}
```

## Fluxo Corrigido

```text
1. Cliente responde a uma mensagem no WhatsApp
2. UAZAPI envia webhook com campo "quoted" contendo dados da mensagem original
3. Webhook extrai: quoted.body (texto), quoted.senderName (quem enviou), quoted.id (ID)
4. Dados salvos em: quoted_content, quoted_sender_name, quoted_message_id
5. Frontend (ZappMessageBubble) renderiza barra de citação acima da resposta
```

## Visualização no Frontend (já implementado)

O componente `ZappMessageBubble` já possui a renderização:

```typescript
{message.quoted_content && (
  <div className="bg-black/20 border-l-4 border-zapp-accent/60 px-2 py-1.5 mb-2 rounded-r">
    <p className="text-xs font-medium text-zapp-accent truncate">
      {message.quoted_sender_name || ""}
    </p>
    <p className="text-xs text-zapp-text-muted/80 line-clamp-2">
      {message.quoted_content}
    </p>
  </div>
)}
```

## Resultado Esperado

Após a correção:
- Mensagens de resposta mostrarão uma barra com a mensagem original
- O nome do remetente original será exibido
- Se a mensagem original for mídia, exibirá emoji representativo (📷, 🎬, 🎤, etc.)
- Mensagens antigas sem dados de citação continuarão sem (não há retroatividade)

## Testes Recomendados

1. Enviar uma resposta a uma mensagem de texto pelo WhatsApp
2. Verificar se a citação aparece no ROY zAPP
3. Testar resposta a imagem (deve mostrar "📷 Imagem" ou caption)
4. Testar resposta a áudio (deve mostrar "🎤 Áudio")
5. Verificar se o nome do remetente original aparece corretamente
