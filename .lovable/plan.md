

## Abrir diálogo de nova tarefa ao concluir pela edição (TaskDialog)

### Problema

Ao editar uma tarefa, marcar "Marcar como concluída" e salvar, o diálogo fecha mas nao abre automaticamente o diálogo de nova tarefa. Isso acontece porque o `TaskDialog` chama `onOpenChange(false)` e `onSuccess()` (que apenas recarrega as tarefas), sem sinalizar ao `DealActivitiesTab` que houve uma conclusao.

### Solucao

Adicionar um callback opcional `onTaskCompleted` ao `TaskDialog`, que sera chamado quando uma tarefa existente for salva com o checkbox de conclusao marcado. O `DealActivitiesTab` usara esse callback para abrir o dialogo de nova tarefa.

### Alteracoes

**Arquivo: `src/components/tasks/TaskDialog.tsx`**

1. Adicionar prop opcional `onTaskCompleted?: () => void` na interface `TaskDialogProps`
2. No `handleSubmit`, quando `task` existe (edicao) e `isCompleted` esta marcado e a tarefa **nao estava** concluida antes (`!task.completed_at`), chamar `onTaskCompleted?.()` apos fechar o dialogo

**Arquivo: `src/components/sales/DealActivitiesTab.tsx`**

1. Passar a prop `onTaskCompleted` ao `TaskDialog` com uma funcao que:
   - Aguarda `fetchTasks()`
   - Invalida o cache
   - Abre o dialogo de nova tarefa (`setEditingTask(null)` + `setTaskDialogOpen(true)`)

### Detalhes tecnicos

No `TaskDialog.tsx`, dentro de `handleSubmit` (linhas 321-408), apos a atualizacao bem-sucedida:

```
// Linha ~401, antes de onOpenChange(false)
const wasCompletedBefore = !!task.completed_at;
// ... apos o update ...
onOpenChange(false);
onSuccess();
if (isCompleted && !wasCompletedBefore) {
  onTaskCompleted?.();
}
```

No `DealActivitiesTab.tsx`, no componente `TaskDialog`:

```
<TaskDialog
  ...
  onTaskCompleted={async () => {
    await fetchTasks();
    queryClient.invalidateQueries({ queryKey: ["internal-tasks"] });
    setEditingTask(null);
    setTaskDialogOpen(true);
  }}
/>
```

Isso garante que ambos os caminhos (checkbox e edicao) abram o dialogo de nova tarefa ao concluir.

