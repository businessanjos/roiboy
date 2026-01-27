
# Plano: Corrigir Mensagens Aparecendo na Conversa Errada

## Problema Identificado

Quando o usuario troca de conversa no ROY zAPP, as mensagens da conversa anterior continuam sendo exibidas momentaneamente (ou permanentemente em caso de erro), causando a exibicao de mensagens de texto e audio de uma conversa dentro de outra.

### Causa Raiz
1. O estado `messages` nao e limpo imediatamente ao trocar de conversa
2. Existe uma race condition onde o fetchMessages() e assincrono, mas a UI ja mostra a nova conversa com mensagens antigas
3. Os handlers de realtime no hook useZappData atualizam o estado `messages` sem verificar se a mensagem pertence a conversa atualmente selecionada

### Evidencia
No banco de dados as mensagens estao corretamente associadas as suas conversas. A mensagem "Audio da minha cliente kkk" esta na conversa "Suelen Lupi" (id: ff043d95-...), nao na "Natalia e Marine" (id: e897c10b-...). O problema e exclusivamente no frontend.

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/RoyZapp.tsx` | Limpar mensagens ao trocar de conversa e validar conversation ID no realtime |
| `src/hooks/useZappData.tsx` | Adicionar referencia de conversa atual para validacao em updates de realtime |

## Alteracoes Tecnicas

### 1. Limpar Mensagens Imediatamente ao Trocar de Conversa

**Arquivo:** `src/pages/RoyZapp.tsx` (linhas 602-608)

O useEffect que busca mensagens deve limpar o estado ANTES de iniciar o fetch:

```typescript
// Fetch messages when conversation is selected
useEffect(() => {
  const zappConvId = selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id;
  
  // CRITICAL FIX: Clear messages IMMEDIATELY when conversation changes
  // This prevents showing messages from previous conversation during fetch
  setMessages([]);
  
  if (zappConvId) {
    fetchMessages(zappConvId);
  }
}, [selectedConversation?.id, fetchMessages, setMessages]);
```

### 2. Armazenar ID da Conversa Atual para Validacao

**Arquivo:** `src/pages/RoyZapp.tsx`

Criar uma ref para rastrear a conversa atualmente selecionada:

```typescript
// Ref to track current conversation ID for realtime validation
const currentConversationIdRef = useRef<string | null>(null);

// Update ref when conversation changes
useEffect(() => {
  currentConversationIdRef.current = 
    selectedConversation?.zapp_conversation_id || 
    selectedConversation?.zapp_conversation?.id || 
    null;
}, [selectedConversation?.id, selectedConversation?.zapp_conversation_id, selectedConversation?.zapp_conversation?.id]);
```

### 3. Validar Conversa no Handler de Realtime

**Arquivo:** `src/pages/RoyZapp.tsx` (linhas 620-680)

Atualizar o handler de realtime para validar que a mensagem pertence a conversa atual:

```typescript
const messagesChannel = supabase
  .channel(`zapp-messages-${zappConvId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'zapp_messages',
      filter: `zapp_conversation_id=eq.${zappConvId}`
    },
    (payload) => {
      const newMsg = payload.new as any;
      
      // CRITICAL FIX: Validate this message belongs to CURRENTLY selected conversation
      // This prevents messages from being added if user switched conversations
      if (currentConversationIdRef.current !== zappConvId) {
        console.log("[RoyZapp] Ignoring realtime INSERT - conversation changed:", {
          receivedFor: zappConvId,
          currentlySelected: currentConversationIdRef.current
        });
        return;
      }
      
      // ... rest of existing handler logic
    }
  )
```

### 4. Validar no setMessages do Hook useZappData

**Arquivo:** `src/hooks/useZappData.tsx` (linhas 780-800)

O hook ja tem um problema onde atualiza mensagens sem verificar a conversa. Adicionar parametro de conversa atual:

Exportar a funcao fetchMessages com uma variante que aceita callback de validacao, ou adicionar logica para ignorar updates de mensagens que nao estao no array atual (ja que isso significa que a conversa mudou).

```typescript
// Update the message in local state ONLY if it exists (belongs to current conversation)
if (newData?.media_download_status && newData?.media_url) {
  setMessages(prevMessages => {
    // If message doesn't exist in current state, it's for a different conversation
    const messageExists = prevMessages.some(msg => msg.id === newData.id);
    if (!messageExists) {
      console.log("[ZappData] Ignoring UPDATE for message not in current conversation:", newData.id);
      return prevMessages;
    }
    return prevMessages.map(msg => 
      msg.id === newData.id 
        ? { 
            ...msg, 
            media_url: newData.media_url, 
            media_download_status: newData.media_download_status 
          } 
        : msg
    );
  });
}
```

## Fluxo Corrigido

```text
1. Usuario esta na conversa A, messages = [mensagens de A]
2. Usuario clica na conversa B
3. setSelectedConversation(B) e chamado
4. useEffect dispara:
   a. setMessages([]) ← LIMPA IMEDIATAMENTE
   b. fetchMessages(B) inicia
5. UI mostra conversa B com lista de mensagens vazia (loading)
6. Fetch completa → setMessages([mensagens de B])
7. UI mostra mensagens corretas de B
```

## Beneficios

- Mensagens NUNCA aparecerao na conversa errada
- O estado e sempre consistente com a conversa selecionada
- Race conditions sao eliminadas pela limpeza imediata
- Validacoes de realtime previnem insercoes acidentais

## Testes Recomendados

1. Alternar rapidamente entre varias conversas
2. Verificar que mensagens nao "vazam" de uma conversa para outra
3. Testar recebimento de mensagens via realtime enquanto troca de conversa
4. Confirmar que audio e texto aparecem apenas em suas conversas originais
