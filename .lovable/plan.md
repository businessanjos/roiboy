
# Plano: Adicionar Opção "Atualizar Mensagens" no Menu de Ações

## Objetivo

Inserir uma nova opção **"Atualizar Mensagens"** no dropdown de mais ações (⋮) do ROY zAPP que busca mensagens do WhatsApp que chegaram no aplicativo mas ainda não foram capturadas pela plataforma.

## Análise Técnica

### O que já existe

| Componente | Status |
|------------|--------|
| Edge Function `sync-chat-history` | ✅ Já implementada |
| Deduplicação por `external_message_id` | ✅ Já funciona |
| Exemplo de uso em Admin | ✅ `WhatsAppDiagnostics.tsx` |

A action `sync-chat-history` no `uazapi-manager` já:
- Busca mensagens do UAZAPI via múltiplos endpoints
- Verifica se cada mensagem já existe (por `external_message_id`)
- Só insere mensagens que **não existem** no banco
- Marca as mensagens importadas com `synced_from_history: true`

### O que precisa ser feito

Conectar essa funcionalidade ao dropdown de ações do painel de conversas.

---

## Modificações Necessárias

### 1. Arquivo: `src/components/royzapp/ZappConversationPanel.tsx`

**Adicionar import do ícone RefreshCw:**
```typescript
import { RefreshCw } from "lucide-react";
```

**Adicionar nova prop na interface (~linha 146):**
```typescript
onRefreshMessages?: () => void;
isRefreshingMessages?: boolean;
```

**Adicionar parâmetros na desestruturação:**
```typescript
onRefreshMessages,
isRefreshingMessages,
```

**Adicionar novo item no DropdownMenu (após "Configurações", ~linha 518):**
```typescript
<DropdownMenuSeparator className="bg-zapp-border" />
<DropdownMenuItem 
  className="text-zapp-text hover:bg-zapp-hover"
  onClick={onRefreshMessages}
  disabled={isRefreshingMessages}
>
  <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshingMessages && "animate-spin")} />
  {isRefreshingMessages ? "Atualizando..." : "Atualizar Mensagens"}
</DropdownMenuItem>
```

### 2. Arquivo: `src/pages/RoyZapp.tsx`

**Adicionar estado para controle de loading (~linha 400):**
```typescript
const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
```

**Criar função de refresh (~linha 2600, após importRecentConversations):**
```typescript
const refreshMessages = useCallback(async () => {
  if (!selectedIntegrationId) {
    toast.error("Nenhuma instância WhatsApp selecionada");
    return;
  }
  
  setIsRefreshingMessages(true);
  try {
    const response = await supabase.functions.invoke("uazapi-manager", {
      body: { 
        action: "sync-chat-history", 
        integration_id: selectedIntegrationId,
        days: 3, // Buscar últimos 3 dias (período recente)
      },
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    const result = response.data?.data;
    if (result) {
      if (result.synced > 0) {
        toast.success(
          `${result.synced} mensagens sincronizadas!`,
          { description: `${result.skipped} já existiam no sistema.` }
        );
        // Recarregar mensagens da conversa ativa se houver
        fetchData();
      } else {
        toast.info("Nenhuma mensagem nova encontrada", {
          description: `${result.skipped} mensagens já estavam sincronizadas.`
        });
      }
    }
  } catch (error) {
    console.error("Erro ao atualizar mensagens:", error);
    toast.error("Erro ao buscar mensagens do WhatsApp");
  } finally {
    setIsRefreshingMessages(false);
  }
}, [selectedIntegrationId, fetchData]);
```

**Passar props para ZappConversationPanel (~linha 3893):**
```typescript
onRefreshMessages={refreshMessages}
isRefreshingMessages={isRefreshingMessages}
```

---

## Fluxo de Funcionamento

```text
Usuário clica no ⋮ → "Atualizar Mensagens"
                │
                ▼
    refreshMessages() chamado
    setIsRefreshingMessages(true)
                │
                ▼
    Edge Function: sync-chat-history
    integration_id: selectedIntegrationId
    days: 3
                │
                ▼
    ┌─────────────────────────────────────┐
    │ Para cada conversa da instância:    │
    │ 1. Busca mensagens do UAZAPI        │
    │ 2. Verifica external_message_id     │
    │ 3. Se não existe → INSERT           │
    │    Se existe → SKIP (sem duplicar!) │
    └─────────────────────────────────────┘
                │
                ▼
    Toast: "X mensagens sincronizadas!"
    fetchData() para atualizar a UI
```

---

## Resultado Visual

O dropdown passará de:

```text
┌──────────────────┐
│ 👥 Equipe        │
│ 🏢 Departamentos │
│ ⚙️ Configurações │
└──────────────────┘
```

Para:

```text
┌────────────────────────┐
│ 👥 Equipe              │
│ 🏢 Departamentos       │
│ ⚙️ Configurações       │
│ ─────────────────────  │
│ 🔄 Atualizar Mensagens │
└────────────────────────┘
```

---

## Garantia Contra Duplicatas

A função `sync-chat-history` já possui verificação de deduplicação robusta:

```typescript
// Linha 3983-3993 do uazapi-manager
const { data: existingMsg } = await supabase
  .from("zapp_messages")
  .select("id")
  .eq("external_message_id", messageId)  // ← Chave única do WhatsApp
  .eq("conversation_id", conversation.id)
  .maybeSingle();

if (existingMsg) {
  skippedCount++;  // ← Pula se já existe
  continue;
}
```

Isso garante que **nenhuma mensagem será duplicada**, mesmo que o usuário clique várias vezes.

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `ZappConversationPanel.tsx` | Adicionar import `RefreshCw`, props `onRefreshMessages` e `isRefreshingMessages`, novo `DropdownMenuItem` |
| `RoyZapp.tsx` | Adicionar estado `isRefreshingMessages`, função `refreshMessages`, passar props ao componente |

## Resultado Esperado

1. ✅ Nova opção "Atualizar Mensagens" no dropdown de ações
2. ✅ Busca mensagens dos últimos 3 dias do WhatsApp
3. ✅ **Não cria duplicatas** (verificação por `external_message_id`)
4. ✅ Feedback visual durante a sincronização (ícone girando)
5. ✅ Toast informando quantas mensagens foram sincronizadas
6. ✅ UI atualizada automaticamente após sincronização
