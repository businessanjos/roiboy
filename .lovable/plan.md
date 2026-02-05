

# Correção Definitiva: Fila Mostrando Conversas Já Atribuídas

## Análise Detalhada do Problema

Após análise profunda do código, identifiquei **DOIS PROBLEMAS DISTINTOS** que causam o bug:

### Problema 1: Estatísticas (Stats) Incorretas

**Localização**: `src/pages/RoyZapp.tsx`, linhas 3789-3791

```tsx
// CÓDIGO COM BUG:
const totalQueueConversations = hasFullVisibility
  ? assignments.filter((a) => a.status !== "closed" && !a.zapp_conversation?.is_archived).length  // ← BUG! Conta TODAS as conversas
  : assignments.filter((a) => a.agent_id === null && a.status !== "closed" && !a.zapp_conversation?.is_archived).length;
```

**Problema**: Para Admin/Gestor (`hasFullVisibility = true`), a contagem da Fila mostra TODAS as conversas ativas, não apenas as sem agente. Por isso o badge mostra "Fila (58)" quando deveria mostrar apenas conversas aguardando atribuição.

**Impacto**: O número exibido no badge está incorreto.

### Problema 2: Dependência Faltando no useMemo

**Localização**: `src/pages/RoyZapp.tsx`, linha 3770

```tsx
// CÓDIGO COM BUG:
}, [assignments, searchQuery, filterStatus, filterUnread, filterConversationType, filterArchived, inboxTab, currentAgent?.id, filterProductId, filterTagId, filterAgentId, clientProducts, isAdmin]);
// ← FALTA: currentUser?.team_role_name
```

**Problema**: A variável `hasFullVisibility` depende de `currentUser?.team_role_name` (linha 3731), mas essa dependência não está na lista do useMemo. Isso pode causar cache incorreto do filtro quando o role do usuário muda.

**Impacto**: O filtro pode usar valor desatualizado de `hasFullVisibility`.

### Problema 3: Potencial do matchesStatus

**Localização**: `src/pages/RoyZapp.tsx`, linha 3743-3744

```tsx
const matchesStatus = filterStatus === "all" || filterStatus === "closed" ||
  (filterStatus === "triage" ? a.agent_id === null : a.status === filterStatus);
```

Quando `filterStatus === "all"`, todos os status passam (`matchesStatus = true`). Isso está correto, desde que o `matchesTab` funcione corretamente para filtrar por `agent_id === null` na Fila.

---

## Solução Definitiva

### Mudança 1: Corrigir as Estatísticas (Stats)

A contagem da Fila deve SEMPRE mostrar apenas conversas sem agente, independente de quem está visualizando:

```tsx
// ANTES (COM BUG):
const totalQueueConversations = hasFullVisibility
  ? assignments.filter((a) => a.status !== "closed" && !a.zapp_conversation?.is_archived).length
  : assignments.filter((a) => a.agent_id === null && a.status !== "closed" && !a.zapp_conversation?.is_archived).length;

// DEPOIS (CORRIGIDO):
const totalQueueConversations = assignments.filter((a) => 
  a.agent_id === null && 
  a.status !== "closed" && 
  !a.zapp_conversation?.is_archived
).length;
// A Fila SEMPRE mostra apenas conversas sem agente, para TODOS os usuários
```

### Mudança 2: Corrigir o queueUnreadCount

```tsx
// ANTES (COM BUG):
const queueUnreadCount = hasFullVisibility
  ? assignments.filter((a) => 
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived &&
      (a.zapp_conversation?.unread_count || 0) > 0
    ).length
  : assignments.filter((a) => 
      a.agent_id === null &&
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived &&
      (a.zapp_conversation?.unread_count || 0) > 0
    ).length;

// DEPOIS (CORRIGIDO):
const queueUnreadCount = assignments.filter((a) => 
  a.agent_id === null &&
  a.status !== "closed" && 
  !a.zapp_conversation?.is_archived &&
  (a.zapp_conversation?.unread_count || 0) > 0
).length;
// Badge de não lidos na Fila sempre mostra apenas conversas SEM agente
```

### Mudança 3: Adicionar Dependência Faltando no useMemo de filteredAssignments

```tsx
// ANTES:
}, [assignments, searchQuery, filterStatus, filterUnread, filterConversationType, filterArchived, inboxTab, currentAgent?.id, filterProductId, filterTagId, filterAgentId, clientProducts, isAdmin]);

// DEPOIS:
}, [assignments, searchQuery, filterStatus, filterUnread, filterConversationType, filterArchived, inboxTab, currentAgent?.id, filterProductId, filterTagId, filterAgentId, clientProducts, isAdmin, currentUser?.team_role_name]);
```

---

## Resumo de Mudanças

| Linha | Arquivo | Mudança |
|-------|---------|---------|
| 3789-3791 | RoyZapp.tsx | Remover condição `hasFullVisibility` de `totalQueueConversations` |
| 3818-3823 | RoyZapp.tsx | Remover condição `hasFullVisibility` de `queueUnreadCount` |
| 3770 | RoyZapp.tsx | Adicionar `currentUser?.team_role_name` às dependências do useMemo |

---

## Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────────────┐
│                    FILA - COMPORTAMENTO CORRIGIDO                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  CONTAGEM (Badge):                                                 │
│  └─ SEMPRE: count(agent_id === null)                              │
│     Mostra apenas conversas sem responsável atribuído             │
│                                                                    │
│  LISTA VISUAL:                                                     │
│  └─ SEMPRE: filter(agent_id === null)                             │
│     Exibe apenas conversas aguardando atribuição                  │
│                                                                    │
│  IGUALDADE UNIVERSAL:                                              │
│  └─ Admin vê a mesma Fila que atendentes                          │
│  └─ O número do badge = quantidade de items na lista              │
│                                                                    │
│  MONITORAMENTO (Admin/Gestor):                                     │
│  └─ Usa a aba "Minhas" para ver TODAS as conversas ativas         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Por Que Esta Solução é Definitiva

1. **Semântica consistente**: A "Fila" sempre representa conversas aguardando atendimento
2. **Badge correto**: O número exibido corresponde exatamente aos itens visíveis
3. **Eliminação de ambiguidade**: Não há mais diferença entre o que Admin e atendentes veem na Fila
4. **Cache correto**: A dependência adicionada garante que o useMemo recalcula quando necessário
5. **Monitoramento preservado**: Admin/Gestor ainda podem ver todas as conversas na aba "Minhas"

