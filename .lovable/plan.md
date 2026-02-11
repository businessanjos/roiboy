
## Correções no fluxo de conclusão/reabertura de tarefas

### Problema 1: Checkbox "Marcar como concluída" vem marcada ao criar nova tarefa

Quando o diálogo abre automaticamente após concluir uma tarefa, o campo "Marcar como concluída" pode aparecer pré-marcado. Isso acontece porque o estado `isCompleted` pode não ser resetado corretamente dependendo do fluxo de renderização. A correção garante que ao abrir o diálogo em modo criação, o `isCompleted` sempre seja `false`, adicionando um reset explícito no momento que o diálogo é aberto para nova tarefa no `DealActivitiesTab`.

### Problema 2: Desmarcar "concluída" e salvar não reabre a tarefa

Ao editar uma tarefa concluída, desmarcar "Marcar como concluída" e salvar, a tarefa continua aparecendo como concluída. A causa é que o `TaskDialog` atualiza apenas o campo `completed_at` (para `null`), mas **não** atualiza o `custom_status_id`. Como o `DealActivitiesTab` verifica ambos (`custom_status.is_completed_status || completed_at`) para classificar a tarefa, o `custom_status_id` antigo (que aponta para um status de conclusão) mantém a tarefa como "concluída".

### Alterações

**Arquivo: `src/components/tasks/TaskDialog.tsx`**

Na função `handleSubmit`, ao montar o `updateData` para tarefas existentes:
- Buscar o status adequado (primeiro status de conclusão ou primeiro status pendente) baseado no valor de `isCompleted`
- Incluir `custom_status_id` no objeto de atualização, sincronizando-o com o estado do checkbox

**Arquivo: `src/components/sales/DealActivitiesTab.tsx`**

Garantir que ao abrir o diálogo automaticamente após conclusão, o `isCompleted` seja explicitamente resetado, adicionando um pequeno delay ou garantindo a ordem correta dos estados para evitar qualquer race condition na inicialização do formulário.
