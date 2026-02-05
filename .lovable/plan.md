

# Correção: Aba "Fila" Mostrando Conversas Já Atribuídas

## Problema Identificado

A lógica implementada anteriormente estava incorreta para a aba "Fila":

```tsx
// CÓDIGO COM BUG (linha 3737):
: (hasFullVisibility ? true : a.agent_id === null)
```

Esta lógica diz: "Se Admin/Gestor, mostrar TODAS as conversas na Fila". Isso causa o bug visível nas screenshots onde conversas já atribuídas (com nomes de agentes como "Michele Santos", "Dayara Grecco", etc.) aparecem na Fila.

## Comportamento Correto

| Aba | Atendente Comum | Admin/Gestor |
|-----|-----------------|--------------|
| **Minhas** | Somente conversas atribuídas a ele (`agent_id === currentAgent.id`) | TODAS as conversas atribuídas (para monitoramento) |
| **Fila** | Conversas sem agente (`agent_id === null`) | Conversas sem agente (`agent_id === null`) - **IGUAL para todos** |

**A Fila representa conversas aguardando atendimento - isso é universal, independente do tipo de usuário.**

---

## Correção Proposta

**Arquivo**: `src/pages/RoyZapp.tsx`
**Linha**: 3734-3738

```tsx
// ANTES (COM BUG):
const matchesTab = (filterArchived || filterStatus === "closed" || skipTabFilterForGroups) ? true : (
  inboxTab === "mine" 
    ? (hasFullVisibility || a.agent_id === currentAgent?.id)
    : (hasFullVisibility ? true : a.agent_id === null) // ⚠️ BUG AQUI
);

// DEPOIS (CORRIGIDO):
const matchesTab = (filterArchived || filterStatus === "closed" || skipTabFilterForGroups) ? true : (
  inboxTab === "mine" 
    ? (hasFullVisibility || a.agent_id === currentAgent?.id) // Admin/Gestor veem todas as conversas atribuídas
    : a.agent_id === null // Fila SEMPRE mostra apenas conversas sem agente
);
```

---

## Fluxo de Visibilidade Corrigido

```text
┌────────────────────────────────────────────────────────────────┐
│                    VISUALIZAÇÃO DO ROY zAPP                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ABA "MINHAS"                                                  │
│  ├─ Atendente Comum: Só vê conversas onde agent_id = seu ID   │
│  └─ Admin/Gestor: Vê TODAS as conversas atribuídas            │
│                                                                │
│  ABA "FILA"                                                    │
│  ├─ Atendente Comum: Vê conversas onde agent_id = null        │
│  └─ Admin/Gestor: Vê conversas onde agent_id = null           │
│     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^       │
│     IGUAL PARA TODOS - Fila é apenas conversas sem agente     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Por Que a Fila Deve Ser Igual Para Todos?

1. **Semântica clara**: A "Fila" representa literalmente conversas aguardando um responsável
2. **Evita confusão**: Se Admin visse conversas atribuídas na Fila, não saberia quais precisa distribuir
3. **Monitoramento de atribuídas**: Admin/Gestor já pode ver todas na aba "Minhas"
4. **UX consistente**: O contador "Fila (52)" deve refletir exatamente quantas precisam de atendimento

---

## Arquivo a Modificar

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/pages/RoyZapp.tsx` | 3737 | Remover a condição `hasFullVisibility` do filtro da Fila |

---

## Resultado Esperado

- **Antes**: Fila mostra 52 conversas (incluindo já atribuídas)
- **Depois**: Fila mostra apenas conversas SEM agente atribuído
- Admin/Gestor continua podendo ver todas as conversas atribuídas na aba "Minhas"

