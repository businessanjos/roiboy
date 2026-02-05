
# Correção: Drag-and-Drop de Tarefas e Subtarefas no Kanban de Marketing

## Diagnóstico Detalhado

Após análise completa do código, identifiquei **DOIS PROBLEMAS DISTINTOS** causando as falhas de reordenação:

---

## Problema 1: Tarefas do Kanban Não Persistem Nova Posição

### Causa Raiz
O componente `MarketingTaskKanban.tsx` **não implementa lógica de reordenação** dentro da mesma coluna. O `handleDragEnd` apenas trata mudança de status (mover entre colunas), mas **ignora completamente** a reordenação de cards dentro da mesma coluna.

### Código Atual (Linhas 83-110 de MarketingTaskKanban.tsx)
```tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  setActiveTask(null);

  if (!over) return;

  const taskId = active.id as string;
  const overId = over.id as string;

  // Check if dropped on a column
  if (columns.some((col) => col.status === overId)) {
    const newStatus = overId as MarketingTaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus);  // ← Só muda status
    }
    return;
  }

  // Check if dropped on another task
  const overTask = tasks.find((t) => t.id === overId);
  if (overTask) {
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== overTask.status) {
      onStatusChange(taskId, overTask.status);  // ← Também só muda status
    }
    // ← FALTA: Reordenar cards na mesma coluna!
  }
};
```

### O Que Está Faltando
1. Uso de `arrayMove` do `@dnd-kit/sortable` para reordenar localmente
2. Chamada para persistir a nova ordem no banco de dados
3. Callback `onReorder` para atualizar `display_order` das tarefas

---

## Problema 2: Subtarefas Não Têm Drag-and-Drop Implementado

### Causa Raiz
O componente `SubtaskList.tsx` **NÃO implementa drag-and-drop**. O ícone `GripVertical` aparece visualmente mas é apenas decorativo:

```tsx
// Linha 124 de SubtaskList.tsx - Apenas decorativo, sem funcionalidade
<GripVertical className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
```

Não há:
- `DndContext` envolvendo a lista
- `SortableContext` para os itens
- `useSortable` hook em cada item de subtarefa
- Handler `onDragEnd` para reordenar

---

## Solução Proposta

### Mudança 1: Adicionar Reordenação de Tarefas no Kanban

**Arquivo**: `src/components/marketing/tasks/MarketingTaskKanban.tsx`

Adicionar:
- Import de `arrayMove` do `@dnd-kit/sortable`
- Nova prop `onReorderTasks` para persistir a ordem
- Lógica em `handleDragEnd` para reordenar tasks na mesma coluna

**Arquivo**: `src/hooks/useMarketingTasks.ts`

Adicionar nova mutation `reorderTasks` para atualizar `display_order` de múltiplas tarefas em batch.

**Arquivo**: `src/components/marketing/tasks/MarketingTasksTab.tsx`

Passar callback `onReorderTasks` para o componente Kanban.

### Mudança 2: Implementar Drag-and-Drop de Subtarefas

**Arquivo**: `src/components/marketing/tasks/SubtaskList.tsx`

Refatorar completamente para adicionar:
- `DndContext` com sensors configurados
- `SortableContext` com `verticalListSortingStrategy`
- Novo componente `SortableSubtaskItem` com `useSortable`
- Handler `handleDragEnd` usando `arrayMove`
- Chamada ao hook para persistir nova ordem

**Arquivo**: `src/hooks/useMarketingSubtasks.ts`

Adicionar mutation `reorderSubtasks` para atualizar `display_order` em batch.

---

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/components/marketing/tasks/MarketingTaskKanban.tsx` | Adicionar reordenação intra-coluna |
| `src/components/marketing/tasks/MarketingTasksTab.tsx` | Passar callback de reorder |
| `src/hooks/useMarketingTasks.ts` | Adicionar mutation `reorderTasks` |
| `src/components/marketing/tasks/SubtaskList.tsx` | Implementar DnD completo |
| `src/hooks/useMarketingSubtasks.ts` | Adicionar mutation `reorderSubtasks` |

---

## Detalhes Técnicos

### Mutation de Reordenação (Exemplo para Tarefas)

```typescript
const reorderTasks = useMutation({
  mutationFn: async (updates: { id: string; display_order: number }[]) => {
    for (const update of updates) {
      await supabase
        .from("marketing_tasks")
        .update({ display_order: update.display_order })
        .eq("id", update.id);
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
  },
});
```

### Handler de DragEnd para Kanban (com reordenação)

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  setActiveTask(null);

  if (!over) return;

  const taskId = active.id as string;
  const overId = over.id as string;
  const task = tasks.find((t) => t.id === taskId);
  
  if (!task) return;

  // Dropped on a column
  if (columns.some((col) => col.status === overId)) {
    const newStatus = overId as MarketingTaskStatus;
    if (task.status !== newStatus) {
      onStatusChange(taskId, newStatus);
    }
    return;
  }

  // Dropped on another task
  const overTask = tasks.find((t) => t.id === overId);
  if (!overTask) return;

  if (task.status === overTask.status) {
    // REORDER within same column
    const columnTasks = tasksByStatus[task.status];
    const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
    const newIndex = columnTasks.findIndex((t) => t.id === overId);
    
    if (oldIndex !== newIndex) {
      const reordered = arrayMove(columnTasks, oldIndex, newIndex);
      const updates = reordered.map((t, index) => ({
        id: t.id,
        display_order: index,
      }));
      onReorderTasks(updates);
    }
  } else {
    // Move to different column
    onStatusChange(taskId, overTask.status);
  }
};
```

### Estrutura SortableSubtaskItem para Subtarefas

```tsx
function SortableSubtaskItem({ subtask, onToggle, onEdit, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="...">
      <div {...attributes} {...listeners}>
        <GripVertical className="h-3 w-3 cursor-grab" />
      </div>
      {/* resto do conteúdo */}
    </div>
  );
}
```

---

## Fluxo de Reordenação Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│                    TAREFAS DO KANBAN                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Usuário arrasta Card A sobre Card B (mesma coluna)        │
│  └──▶ handleDragEnd detecta mesmo status                   │
│       └──▶ arrayMove reordena array local                  │
│            └──▶ onReorderTasks persiste no banco           │
│                 └──▶ invalidateQueries atualiza UI         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SUBTAREFAS                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Usuário arrasta Subtarefa 1 sobre Subtarefa 3             │
│  └──▶ DndContext detecta dragEnd                           │
│       └──▶ arrayMove reordena array                        │
│            └──▶ reorderSubtasks persiste ordem             │
│                 └──▶ invalidateQueries atualiza UI         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Resumo das Correções

| Problema | Componente | Correção |
|----------|------------|----------|
| Tarefas voltam à posição original | `MarketingTaskKanban.tsx` | Adicionar lógica de reorder com `arrayMove` e persistência |
| Subtarefas não se movem | `SubtaskList.tsx` | Implementar DnD completo com `DndContext`, `SortableContext`, `useSortable` |

---

## Resultado Esperado

Após implementação:
1. Arrastar tarefa dentro da mesma coluna reordena permanentemente
2. Arrastar tarefa para outra coluna muda status (já funciona)
3. Arrastar subtarefa reordena permanentemente a lista
4. Ícone GripVertical funciona como handle de drag real
