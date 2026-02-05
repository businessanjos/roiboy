

# Correção: Remover Delay no Reposicionamento de Cards

## Problema Identificado

O delay de ~2 segundos ocorre porque as mutations `reorderTasks` e `reorderSubtasks` seguem este fluxo:

```text
Usuário arrasta card → Mutation envia para banco → Aguarda resposta → invalidateQueries → Refetch dados → UI atualiza
```

O card volta à posição original durante a espera porque a UI só é atualizada após o `invalidateQueries` completar.

---

## Solução: Optimistic Updates

Implementar **atualizações otimistas** que atualizam o cache local **imediatamente** antes da resposta do banco:

```text
Usuário arrasta card → UI atualiza instantaneamente → Mutation envia para banco em background
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useMarketingTasks.ts` | Adicionar `onMutate` com optimistic update na mutation `reorderTasks` |
| `src/hooks/useMarketingSubtasks.ts` | Adicionar `onMutate` com optimistic update na mutation `reorderSubtasks` |

---

## Detalhes Técnicos

### Mudança 1: useMarketingTasks.ts (linhas 242-260)

**Antes:**
```typescript
const reorderTasks = useMutation({
  mutationFn: async (updates: { id: string; display_order: number }[]) => {
    for (const update of updates) {
      const { error } = await supabase
        .from("marketing_tasks")
        .update({ display_order: update.display_order })
        .eq("id", update.id);
      if (error) throw error;
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
  },
  onError: (error: Error) => {
    toast.error("Erro ao reordenar tarefas: " + error.message);
  },
});
```

**Depois:**
```typescript
const reorderTasks = useMutation({
  mutationFn: async (updates: { id: string; display_order: number }[]) => {
    for (const update of updates) {
      const { error } = await supabase
        .from("marketing_tasks")
        .update({ display_order: update.display_order })
        .eq("id", update.id);
      if (error) throw error;
    }
  },
  onMutate: async (updates) => {
    // Cancelar queries em andamento para evitar sobrescrita
    await queryClient.cancelQueries({ queryKey: ["marketing-tasks"] });

    // Snapshot do estado anterior para rollback
    const previousTasks = queryClient.getQueryData<MarketingTask[]>(["marketing-tasks"]);

    // Atualizar cache IMEDIATAMENTE (optimistic update)
    queryClient.setQueryData<MarketingTask[]>(["marketing-tasks"], (old) => {
      if (!old) return old;
      return old.map((task) => {
        const update = updates.find((u) => u.id === task.id);
        return update ? { ...task, display_order: update.display_order } : task;
      }).sort((a, b) => a.display_order - b.display_order);
    });

    return { previousTasks };
  },
  onError: (error, _, context) => {
    // Rollback em caso de erro
    if (context?.previousTasks) {
      queryClient.setQueryData(["marketing-tasks"], context.previousTasks);
    }
    toast.error("Erro ao reordenar tarefas: " + error.message);
  },
  onSettled: () => {
    // Sincronizar com servidor após conclusão
    queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
  },
});
```

### Mudança 2: useMarketingSubtasks.ts (linhas 151-168)

**Antes:**
```typescript
const reorderSubtasks = useMutation({
  mutationFn: async (updates: { id: string; display_order: number }[]) => {
    for (const update of updates) {
      const { error } = await supabase
        .from("marketing_task_subtasks")
        .update({ display_order: update.display_order })
        .eq("id", update.id);
      if (error) throw error;
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["marketing-subtasks", taskId] });
  },
  onError: (error: Error) => {
    toast.error("Erro ao reordenar subtarefas: " + error.message);
  },
});
```

**Depois:**
```typescript
const reorderSubtasks = useMutation({
  mutationFn: async (updates: { id: string; display_order: number }[]) => {
    for (const update of updates) {
      const { error } = await supabase
        .from("marketing_task_subtasks")
        .update({ display_order: update.display_order })
        .eq("id", update.id);
      if (error) throw error;
    }
  },
  onMutate: async (updates) => {
    // Cancelar queries em andamento
    await queryClient.cancelQueries({ queryKey: ["marketing-subtasks", taskId] });

    // Snapshot para rollback
    const previousSubtasks = queryClient.getQueryData<MarketingSubtask[]>(["marketing-subtasks", taskId]);

    // Atualizar cache IMEDIATAMENTE
    queryClient.setQueryData<MarketingSubtask[]>(["marketing-subtasks", taskId], (old) => {
      if (!old) return old;
      return old.map((subtask) => {
        const update = updates.find((u) => u.id === subtask.id);
        return update ? { ...subtask, display_order: update.display_order } : subtask;
      }).sort((a, b) => a.display_order - b.display_order);
    });

    return { previousSubtasks };
  },
  onError: (error, _, context) => {
    // Rollback em caso de erro
    if (context?.previousSubtasks) {
      queryClient.setQueryData(["marketing-subtasks", taskId], context.previousSubtasks);
    }
    toast.error("Erro ao reordenar subtarefas: " + error.message);
  },
  onSettled: () => {
    // Sincronizar após conclusão
    queryClient.invalidateQueries({ queryKey: ["marketing-subtasks", taskId] });
  },
});
```

---

## Como Funciona o Optimistic Update

```text
┌─────────────────────────────────────────────────────────────┐
│                   FLUXO OTIMIZADO                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuário solta o card                                   │
│     └──▶ onMutate é chamado ANTES da request              │
│                                                             │
│  2. onMutate:                                              │
│     ├──▶ Cancela queries em andamento                      │
│     ├──▶ Salva snapshot do estado atual                    │
│     └──▶ Atualiza cache local IMEDIATAMENTE                │
│          └──▶ UI reflete nova posição INSTANTANEAMENTE     │
│                                                             │
│  3. mutationFn executa em background:                      │
│     └──▶ Envia updates para Supabase                       │
│                                                             │
│  4. Se SUCESSO (onSettled):                                │
│     └──▶ invalidateQueries sincroniza estado               │
│                                                             │
│  5. Se ERRO (onError):                                     │
│     └──▶ Rollback para snapshot salvo                      │
│          └──▶ UI reverte para posição anterior             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Card volta à posição original | Card permanece na nova posição |
| Aguarda ~2s para atualizar | Atualização instantânea |
| UX lenta e confusa | UX fluída e responsiva |

