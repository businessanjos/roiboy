
# Plano: Sincronização de Status de Conclusão entre Tarefas e Atividades

## Diagnóstico do Problema

### O que está acontecendo

1. **No DealActivitiesTab**: A função `getComputedStatus()` (linha 76-89) determina se uma tarefa está concluída verificando `task.completed_at`:
   ```typescript
   if (task.completed_at) return "done";
   ```

2. **Na página de Tarefas**: A determinação de conclusão usa apenas `custom_status_id`:
   ```typescript
   const taskStatus = customStatuses.find(s => s.id === task.custom_status_id);
   const isCompleted = taskStatus?.is_completed_status || false;
   ```

3. **Problema de sincronização**: Quando uma tarefa é marcada como concluída no DealActivitiesTab:
   - `completed_at` é preenchido ✅
   - `custom_status_id` é atualizado para um status de conclusão ✅
   - O cache `["internal-tasks"]` é invalidado ✅
   
   **Porém**, verificando os dados no banco, vejo que muitas tarefas possuem `completed_at` preenchido mas `custom_status_id = null`. Isso sugere que algo está falhando na atualização do `custom_status_id`.

### Causa Raiz

A função `handleToggleComplete` no DealActivitiesTab (linhas 163-166) busca estatuses sem filtrar por `account_id`:
```typescript
const { data: statuses } = await supabase
  .from("task_statuses")
  .select("id, is_completed_status")
  .order("display_order"); // Depende do RLS
```

Embora o RLS esteja habilitado, se a query retornar estatuses em ordem diferente ou se encontrar um status de outra conta primeiro, o `targetStatus` pode não ser válido para a tarefa.

---

## Solução

### Modificação 1: Página de Tarefas deve considerar `completed_at`

Atualizar a lógica de `isCompleted` para também verificar `completed_at`:

**Arquivo:** `src/pages/Tasks.tsx`

```typescript
// Linha ~533 (e em outros lugares onde isCompleted é calculado)
// ❌ Código atual
const isCompleted = taskStatus?.is_completed_status || false;

// ✅ Código corrigido
const isCompleted = taskStatus?.is_completed_status || task.completed_at !== null;
```

Essa mesma lógica deve ser aplicada em todos os lugares onde `isCompleted` é calculado na página de Tarefas.

### Modificação 2: Garantir consistência no filtro de abas

O filtro de abas atualmente só considera `custom_status_id`. Tarefas com `completed_at` preenchido mas sem `custom_status_id` não aparecem na aba correta.

**Locais a modificar em `src/pages/Tasks.tsx`:**

1. **Linha ~533 (lista de tarefas)** - Adicionar verificação de `completed_at`
2. **Linha ~830 (Kanban)** - Mesma correção no contexto do Kanban
3. **Contadores de tarefas** - Garantir que contadores considerem `completed_at`

---

## Resumo de Modificações

| Arquivo | Local | Ação |
|---------|-------|------|
| `src/pages/Tasks.tsx` | ~533 | Modificar cálculo de `isCompleted` para incluir `completed_at` |
| `src/pages/Tasks.tsx` | Outros locais com mesma lógica | Aplicar mesma correção |

---

## Resultado Esperado

Após esta correção:
1. Tarefas marcadas como concluídas no DealActivitiesTab aparecerão como concluídas na página de Tarefas
2. O checkbox de conclusão na página de Tarefas mostrará o estado correto
3. O texto da tarefa terá o estilo "riscado" para indicar conclusão
4. A sincronização será consistente entre ambas as visualizações
