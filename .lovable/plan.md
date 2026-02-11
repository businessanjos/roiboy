
## Correção: Diálogo de nova atividade não abre após concluir tarefa

### Causa raiz

Na função `handleToggleComplete`, o `fetchTasks()` é chamado sem `await`. Essa função define `setLoading(true)`, o que causa uma re-renderização do componente (mostrando o spinner de loading). O `setTimeout` de 50ms que abre o diálogo dispara durante essa transição, e o estado `taskDialogOpen` pode ser perdido ou o diálogo não consegue montar corretamente durante o ciclo de loading.

### Correção

**Arquivo: `src/components/sales/DealActivitiesTab.tsx`**

Na função `handleToggleComplete`, trocar a lógica para **aguardar** o `fetchTasks()` antes de abrir o diálogo, e remover o `setTimeout` desnecessário:

```
// Bloco de sucesso (linhas ~186-199)
fetchTasks();  -->  await fetchTasks();

// Remover o setTimeout e abrir diretamente:
if (!isCurrentlyCompleted) {
  setEditingTask(null);
  setTaskDialogOpen(true);
}
```

Com o `await`, o `fetchTasks` completa totalmente (incluindo `setLoading(false)`) antes de abrir o diálogo, garantindo que o componente está estável e o diálogo monta corretamente em modo de criação.

Alteração mínima: trocar `fetchTasks()` por `await fetchTasks()` e remover o `setTimeout`.
