
# Plano: Corrigir Funcionalidade de Resposta/Citação no ROY zAPP

## Problema Identificado

As mensagens enviadas como "resposta" no ROY zAPP não chegam como citação no WhatsApp do destinatário. A mensagem é enviada, mas sem o contexto de qual mensagem está sendo respondida.

## Causa Raiz

O código atual no `uazapi-manager` usa o campo `replyid` para responder mensagens:

```typescript
// Código atual (INCORRETO)
if (quotedMessageId) {
  messageBody.replyid = quotedMessageId;  // "554388346806:AC8FADB8794A355D0DE4051F47A7DBB0"
}
```

Baseado na documentação do WUZAPI/UAZAPI, o formato correto para responder mensagens é usar `ContextInfo` com `StanzaId` e `Participant`:

```json
{
  "Phone": "5491155554444",
  "Body": "Resposta",
  "ContextInfo": {
    "StanzaId": "AC8FADB8794A355D0DE4051F47A7DBB0",
    "Participant": "5491155553935@s.whatsapp.net"
  }
}
```

## Problemas Específicos

1. **Formato do ID incorreto**: O `external_message_id` é salvo como `phone:msgid` (ex: `554388346806:AC8FADB8794A355D0DE4051F47A7DBB0`), mas a UAZAPI espera apenas o `msgid` puro.

2. **Campo errado**: O código usa `replyid` ao invés de `ContextInfo`.

3. **Falta Participant**: Para respostas funcionarem, é necessário enviar o `Participant` (JID de quem enviou a mensagem original).

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-manager/index.ts` | Alterar formato de envio de replies para usar `ContextInfo` |
| `src/pages/RoyZapp.tsx` | Passar informação do remetente original junto com a citação |

## Mudanças Detalhadas

### 1. RoyZapp.tsx - Adicionar `quoted_participant` ao payload

Atualmente o frontend passa:
- `quoted_message_id`: ID da mensagem
- `quoted_from_me`: Se a mensagem citada foi enviada por nós

Precisamos adicionar:
- `quoted_participant`: JID do remetente da mensagem original

O `replyingTo` state já tem a informação se é `is_from_client`, mas precisa do telefone/JID original.

### 2. uazapi-manager/index.ts - Reformatar envio de replies

```typescript
// ANTES (não funciona como citação)
if (quotedMessageId) {
  messageBody.replyid = quotedMessageId;
}

// DEPOIS (formato correto WUZAPI/UAZAPI)
if (quotedMessageId) {
  // Extrair apenas o ID da mensagem (sem prefixo phone:)
  const pureMessageId = quotedMessageId.includes(':') 
    ? quotedMessageId.split(':').pop() 
    : quotedMessageId;
  
  // Para chats 1:1, usar o JID do destinatário como participant
  // Para mensagens inbound citadas (cliente enviou), participant = JID do cliente
  // Para mensagens outbound citadas (nós enviamos), participant = nosso JID
  const participantJid = quotedFromMe 
    ? `${instanceOwner}@s.whatsapp.net`  // Nosso número (owner da instância)
    : `${cleanPhone}@s.whatsapp.net`;    // Número do cliente
  
  messageBody.ContextInfo = {
    StanzaId: pureMessageId,
    Participant: participantJid
  };
  
  console.log(`[send_text] Reply with ContextInfo: StanzaId=${pureMessageId}, Participant=${participantJid}`);
}
```

### 3. Ajuste similar para `send_to_group`

Para mensagens em grupos, o `Participant` deve ser o JID do remetente original:

```typescript
if (quotedMessageId) {
  const pureMessageId = quotedMessageId.includes(':') 
    ? quotedMessageId.split(':').pop() 
    : quotedMessageId;
  
  // Para grupos, precisamos do JID exato de quem enviou a mensagem original
  const participantJid = quotedFromMe 
    ? `${instanceOwner}@s.whatsapp.net`
    : quotedParticipant || `${groupJid}`;  // Fallback para o grupo se não tiver participant
  
  baseBody.ContextInfo = {
    StanzaId: pureMessageId,
    Participant: participantJid
  };
}
```

### 4. Mudanças no Frontend

Modificar `RoyZapp.tsx` para passar o JID/telefone do remetente original:

```typescript
// No payload de envio
if (replyContext?.external_message_id) {
  payload.quoted_message_id = replyContext.external_message_id;
  payload.quoted_from_me = !replyContext.is_from_client;
  // NOVO: Passar o telefone do remetente original para construir o Participant JID
  payload.quoted_participant = replyContext.is_from_client 
    ? phone  // Se foi o cliente que enviou, participant é o telefone do cliente
    : null;  // Se fomos nós, o backend usa o owner da instância
}
```

## Fluxo de Dados Corrigido

```text
1. Usuário clica "Responder" em uma mensagem
   ↓
2. Frontend captura:
   - external_message_id: "554388346806:AC8FADB8794A355D0DE4051F47A7DBB0"
   - is_from_client: true/false
   - phone do contato atual
   ↓
3. Frontend envia para uazapi-manager:
   - quoted_message_id: "554388346806:AC8FADB8794A355D0DE4051F47A7DBB0"
   - quoted_from_me: true/false
   - quoted_participant: "+5511910901007" (se foi mensagem do cliente)
   ↓
4. uazapi-manager extrai:
   - pureMessageId: "AC8FADB8794A355D0DE4051F47A7DBB0" (parte após ":")
   - participantJid: "5511910901007@s.whatsapp.net"
   ↓
5. Envia para UAZAPI:
   {
     "number": "5511910901007",
     "text": "Resposta",
     "ContextInfo": {
       "StanzaId": "AC8FADB8794A355D0DE4051F47A7DBB0",
       "Participant": "5511910901007@s.whatsapp.net"
     }
   }
   ↓
6. UAZAPI processa e envia para WhatsApp como citação real
```

## Testes Necessários

Após implementação, testar:
1. Responder mensagem de cliente (inbound) em chat 1:1
2. Responder nossa própria mensagem (outbound) em chat 1:1
3. Responder mensagem em grupo
4. Verificar se a citação aparece corretamente no WhatsApp do destinatário
5. Verificar se mensagens recebidas com citação ainda exibem corretamente no ROY zAPP

## Notas Técnicas

- O formato `ContextInfo` com `StanzaId` e `Participant` é o padrão documentado pelo WUZAPI (que é a base do UAZAPI)
- O campo `Participant` é crucial - sem ele, o WhatsApp não consegue identificar de quem é a mensagem citada
- O ID puro (sem prefixo phone:) é necessário porque é assim que o WhatsApp identifica mensagens internamente
