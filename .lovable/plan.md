

## Abrir diálogo de nova tarefa automaticamente ao concluir uma tarefa no negócio

### O que sera feito

Quando o vendedor marcar uma tarefa como concluída (checkbox) dentro de um negócio no setor de Vendas, o diálogo de criação de nova tarefa abrirá automaticamente logo em seguida. Isso garante que o vendedor seja incentivado a agendar a próxima atividade, evitando que negócios fiquem sem tarefas pendentes.

### Alteração

**Arquivo:** `src/components/sales/DealActivitiesTab.tsx`

Na função `handleToggleComplete`, após a conclusão bem-sucedida de uma tarefa (quando o usuário está **marcando como concluída**, não desmarcando), o sistema abrirá automaticamente o diálogo de nova tarefa:

- Após o `fetchTasks()` e invalidação de cache (linha ~189), verificar se a ação foi de **concluir** (não reabrir)
- Se sim, limpar o `editingTask` (para garantir que o diálogo abra em modo criação) e abrir o `TaskDialog` com `setTaskDialogOpen(true)`
- O diálogo já vem pré-configurado com o `dealId` e `leadId` corretos, pois essas props já são passadas ao `TaskDialog` existente

### Detalhes técnicos

Dentro de `handleToggleComplete`, a variável `isCurrentlyCompleted` já indica se a tarefa **estava** concluída antes do clique. Quando `isCurrentlyCompleted === false`, significa que o usuário está concluindo a tarefa -- é nesse caso que o diálogo deve abrir:

```
// Após o bloco de sucesso (linha ~186-190):
if (!isCurrentlyCompleted) {
  // Usuário acabou de concluir -> abrir diálogo de nova tarefa
  setEditingTask(null);
  setTaskDialogOpen(true);
}
```

Apenas 3 linhas adicionadas em um único arquivo.
