
# Implementar Scroll para Mensagem Original (Citação Clicável)

## Objetivo
Quando o usuário clicar na barra de citação de uma mensagem (quoted message), o chat deve rolar automaticamente até a mensagem original citada e destacá-la visualmente.

## Arquivos a Modificar

### 1. `src/components/royzapp/ZappMessageBubble.tsx`

**Adicionar nova prop para callback de scroll:**
```typescript
interface ZappMessageBubbleProps {
  message: Message;
  showTimestamp: boolean;
  isGroup: boolean;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  onRetry?: (message: Message) => void;
  onScrollToQuoted?: (quotedMessageId: string) => void; // NOVO
  isHighlighted?: boolean; // NOVO - para efeito visual de destaque
}
```

**Modificar a barra de citação (linhas ~336-346):**
- Tornar clicável com `cursor-pointer`
- Chamar `onScrollToQuoted(quoted_message_id)` ao clicar
- Adicionar animação de destaque quando `isHighlighted` for true

```typescript
{/* Quoted message bar (reply) - CLICÁVEL */}
{message.quoted_content && (
  <div 
    className={cn(
      "bg-black/20 border-l-4 border-zapp-accent/60 px-2 py-1.5 mb-2 rounded-r",
      message.quoted_message_id && "cursor-pointer hover:bg-black/30 transition-colors"
    )}
    onClick={() => {
      if (message.quoted_message_id && onScrollToQuoted) {
        onScrollToQuoted(message.quoted_message_id);
      }
    }}
  >
    <p className="text-xs font-medium text-zapp-accent truncate">
      {message.quoted_sender_name || ""}
    </p>
    <p className="text-xs text-zapp-text-muted/80 line-clamp-2">
      {message.quoted_content}
    </p>
  </div>
)}
```

**Adicionar efeito de highlight na bolha:**
```typescript
// Na div principal da bolha de mensagem
className={cn(
  "px-3 py-2 rounded-lg relative shadow overflow-hidden flex-1 min-w-0",
  message.is_from_client
    ? "bg-zapp-message-in text-zapp-text rounded-tl-none"
    : "bg-zapp-message-out text-zapp-text rounded-tr-none",
  message.send_status === "failed" && "ring-2 ring-red-500/50 bg-red-950/30",
  isHighlighted && "ring-2 ring-zapp-accent animate-pulse" // NOVO
)}
```

### 2. `src/components/royzapp/ZappMessagesList.tsx`

**Adicionar gerenciamento de refs e estado de highlight:**

```typescript
interface ZappMessagesListProps {
  messages: Message[];
  isGroup: boolean;
  onReplyMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  onRetryMessage?: (message: Message) => void;
}

export function ZappMessagesList({ ... }: ZappMessagesListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map()); // NOVO
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null); // NOVO

  // NOVA função: Rolar até mensagem citada
  const handleScrollToQuoted = useCallback((quotedMessageId: string) => {
    // Buscar mensagem pelo external_message_id OU pelo id local
    const targetMessage = deduplicatedMessages.find(
      m => m.external_message_id === quotedMessageId || m.id === quotedMessageId
    );
    
    if (targetMessage) {
      const element = messageRefs.current.get(targetMessage.id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(targetMessage.id);
        
        // Remover highlight após 2 segundos
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }
    }
  }, [deduplicatedMessages]);

  // Limpar refs antigas quando mensagens mudam
  useEffect(() => {
    const currentIds = new Set(deduplicatedMessages.map(m => m.id));
    messageRefs.current.forEach((_, id) => {
      if (!currentIds.has(id)) {
        messageRefs.current.delete(id);
      }
    });
  }, [deduplicatedMessages]);

  return (
    <ScrollArea className="flex-1 px-2 sm:px-4 py-2 overflow-hidden">
      <div className="space-y-1 max-w-full overflow-hidden">
        {deduplicatedMessages.map((message, index) => (
          <div
            key={message.id}
            ref={(el) => {
              if (el) messageRefs.current.set(message.id, el);
            }}
          >
            <ZappMessageBubble
              message={message}
              showTimestamp={...}
              isGroup={isGroup}
              onReply={onReplyMessage}
              onDelete={onDeleteMessage}
              onEdit={onEditMessage}
              onRetry={onRetryMessage}
              onScrollToQuoted={handleScrollToQuoted} // NOVO
              isHighlighted={highlightedMessageId === message.id} // NOVO
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
```

## Fluxo de Funcionamento

```text
┌─────────────────────────────────────────────────────────────────┐
│  1. Usuário clica na barra de citação                          │
│     ↓                                                           │
│  2. ZappMessageBubble chama onScrollToQuoted(quoted_message_id) │
│     ↓                                                           │
│  3. ZappMessagesList.handleScrollToQuoted():                    │
│     - Busca mensagem por external_message_id ou id              │
│     - Obtém ref do elemento DOM via messageRefs                 │
│     - Chama scrollIntoView({ behavior: "smooth", block: "center" }) │
│     - Define highlightedMessageId para efeito visual            │
│     ↓                                                           │
│  4. Mensagem original aparece no centro da tela com destaque    │
│     ↓                                                           │
│  5. Após 2 segundos, highlight é removido automaticamente       │
└─────────────────────────────────────────────────────────────────┘
```

## Resultado Visual

- **Hover na citação**: Cursor muda para `pointer` e fundo fica levemente mais escuro
- **Scroll suave**: Mensagem original rola para o centro da tela
- **Destaque**: Borda colorida (`ring-zapp-accent`) com animação `pulse` por 2 segundos
- **Fallback**: Se mensagem não for encontrada (pode ter sido deletada ou não carregada), nada acontece
