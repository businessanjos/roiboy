
# Plano: Correção do Bug de Realtime no ROY zAPP

## Diagnóstico Confirmado

### Bug Principal Identificado
O código em `src/hooks/useZappData.tsx` nas **linhas 801-808** contém um erro crítico:

```typescript
// CÓDIGO ATUAL - BUGADO (linhas 801-808)
if (newMsg?.id) {
  setMessages(prev => {
    const exists = prev.some(m => m.id === newMsg.id);
    if (exists) {
      return prev;     // ✅ Correto: ignora duplicata
    }
    return prev;       // ❌ BUG: deveria adicionar a nova mensagem!
  });
}
```

**Problema**: Quando uma nova mensagem chega via Realtime, o código verifica se ela já existe, mas em ambos os casos (duplicata ou mensagem nova) retorna apenas `prev`, **nunca adicionando a nova mensagem**.

### Status das Instâncias WhatsApp
Todas as 4 instâncias estão operando normalmente:

| Instância | Setor | Status | Webhook |
|-----------|-------|--------|---------|
| Whatsapp Jota | Vendas | connected | ✅ true |
| [COMERCIAL] Eternum Club | Vendas | connected | ✅ true |
| roy-796e7970-2mlt | Diretoria | connected | ✅ true |
| [CANAL] Eternum Club | Operações | connected | ✅ true |

**Conclusão**: O problema NÃO é na configuração dos webhooks, mas sim no frontend que não está adicionando as mensagens recebidas.

## Modificações Necessárias

### Arquivo: `src/hooks/useZappData.tsx`

#### Correção 1: Bug do INSERT (linhas 799-812)
```typescript
// CÓDIGO CORRIGIDO
// CRITICAL FIX: Check if message already exists and ADD if new
if (newMsg?.id) {
  // Format the new message to match our Message interface
  const newFormattedMsg: Message = {
    id: newMsg.id,
    content: newMsg.content,
    is_from_client: newMsg.direction === 'inbound',
    created_at: newMsg.created_at,
    message_type: newMsg.message_type || 'text',
    media_url: newMsg.media_url,
    media_type: newMsg.media_type,
    media_mimetype: newMsg.media_mimetype,
    media_filename: newMsg.media_filename,
    audio_duration_sec: newMsg.audio_duration_sec,
    sender_name: newMsg.sender_name,
    delivery_status: newMsg.delivery_status,
    media_download_status: newMsg.media_download_status,
    external_message_id: newMsg.external_message_id,
    transcription: newMsg.transcription,
    is_deleted: newMsg.is_deleted,
    quoted_message_id: newMsg.quoted_message_id,
    quoted_content: newMsg.quoted_content,
    quoted_sender_name: newMsg.quoted_sender_name,
    is_edited: newMsg.is_edited,
  };

  setMessages(prev => {
    // Check for duplicates by id or external_message_id
    const exists = prev.some(m => 
      m.id === newMsg.id || 
      (m.external_message_id && m.external_message_id === newMsg.external_message_id)
    );
    if (exists) {
      return prev; // Ignora duplicata
    }
    
    // CRITICAL: Only add if message belongs to current conversation
    // This check was missing and could cause messages appearing in wrong conversations
    if (selectedConversationId && newMsg.zapp_conversation_id !== selectedConversationId) {
      return prev; // Mensagem é de outra conversa
    }
    
    // ADD the new message to the end of the list
    return [...prev, newFormattedMsg];
  });
}
```

#### Correção 2: Validação de Conversa Selecionada
Adicionar verificação antes de inserir para garantir que a mensagem pertence à conversa atualmente aberta:

```typescript
// Antes de processar o INSERT, verificar se é da conversa aberta
const selectedConvId = selectedConversationIdRef.current;
if (selectedConvId && newMsg.zapp_conversation_id !== selectedConvId) {
  // Mensagem é de outra conversa - apenas atualizar lista lateral
  debouncedFetchAssignments();
  return;
}
```

#### Correção 3: Fallback Polling (Opcional - Reforço)
Adicionar polling leve como backup caso realtime falhe:

```typescript
// Polling backup a cada 30 segundos para garantir sincronização
useEffect(() => {
  if (!selectedConversationId) return;
  
  const pollInterval = setInterval(() => {
    // Apenas faz fetch se última mensagem local for mais antiga que 30s
    const lastLocalMsg = messages[messages.length - 1];
    if (lastLocalMsg) {
      const lastMsgTime = new Date(lastLocalMsg.created_at).getTime();
      const now = Date.now();
      if (now - lastMsgTime > 30000) {
        fetchMessagesForConversation(selectedConversationId);
      }
    }
  }, 30000);
  
  return () => clearInterval(pollInterval);
}, [selectedConversationId, messages.length]);
```

## Resumo das Alterações

| Local | Mudança |
|-------|---------|
| Linhas 801-808 | Corrigir lógica para ADICIONAR mensagem nova ao estado |
| Linhas 801-808 | Adicionar validação de conversa selecionada |
| Linhas 801-808 | Melhorar detecção de duplicatas (id + external_message_id) |
| Novo bloco ~linha 870 | Adicionar polling fallback de 30s (opcional) |

## Resultado Esperado

1. ✅ Novas mensagens aparecem automaticamente sem precisar recarregar
2. ✅ Mensagens só aparecem na conversa correta (isolamento)
3. ✅ Duplicatas continuam sendo filtradas
4. ✅ Polling de backup garante sincronização mesmo se realtime falhar
5. ✅ Performance mantida (polling só dispara se necessário)
