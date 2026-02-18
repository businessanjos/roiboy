

## Corrigir tarefas concluidas aparecendo na aba "Pendente"

### Problema

Na logica de filtragem por aba (linha 482-493 de `Tasks.tsx`), a condicao `task.custom_status_id === activeTab` inclui a tarefa sem verificar se ela ja foi concluida (`completed_at`). Quando o usuario marca uma tarefa como concluida (checkbox), o campo `completed_at` e preenchido, mas o `custom_status_id` pode nao ser atualizado para o status de conclusao. Resultado: a tarefa aparece com o check verde mas ainda na aba "Pendente".

### Solucao

Adicionar uma verificacao extra: quando a aba ativa **nao** e um status de conclusao, excluir tarefas que tenham `completed_at` preenchido.

### Mudanca tecnica

**Arquivo: `src/pages/Tasks.tsx`** (linhas 482-493)

Alterar o filtro `filteredTasks` para:

```typescript
const filteredTasks = useMemo(() => baseFilteredTasks.filter((task) => {
  const defaultStatus = customStatuses.find(s => s.is_default);
  const targetStatus = activeTab ? customStatuses.find(s => s.id === activeTab) : null;
  
  if (!activeTab) return true;
  
  // Se a aba ativa NAO e de conclusao, excluir tarefas com completed_at
  if (!targetStatus?.is_completed_status && task.completed_at) return false;
  
  if (task.custom_status_id === activeTab) return true;
  if (!task.custom_status_id && activeTab === defaultStatus?.id && !task.completed_at) return true;
  if (!task.custom_status_id && task.completed_at && targetStatus?.is_completed_status) return true;
  
  return false;
}), [baseFilteredTasks, activeTab, customStatuses]);
```

A unica adicao e a linha: `if (!targetStatus?.is_completed_status && task.completed_at) return false;`

Isso garante que qualquer tarefa com `completed_at` preenchido so apareca em abas marcadas como `is_completed_status`.

