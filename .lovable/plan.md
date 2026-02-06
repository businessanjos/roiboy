

# Plano: Cards de Estatísticas Dinâmicos com Filtros Aplicados

## Problema

Os cards de estatísticas (Pendentes, Em Andamento, Atrasadas, Concluídas) usam `tasks` diretamente, ignorando os filtros aplicados pelo usuário:

```tsx
// Linha 490-496 - Usa `tasks` (todas as tarefas)
const pendingCount = tasks.filter(t => ...
const inProgressCount = tasks.filter(t => ...
const doneCount = tasks.filter(t => ...
const overdueCount = tasks.filter(t => ...
```

## Solução

### 1. Criar `baseFilteredTasks` - Tarefas com Filtros (sem aba)

Antes da linha 407, criar um novo `useMemo` que aplica apenas os filtros de contexto (busca, usuário, tipo de atividade, setor), **sem** filtrar pela aba ativa:

```tsx
// Base filtered tasks - applies all filters EXCEPT tab (for dynamic stats cards)
const baseFilteredTasks = useMemo(() => tasks.filter((task) => {
  // Search filter
  const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.clients?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
  
  // User filter
  const matchesUser = filterUser === "all" || 
    (filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser);

  // Activity type filter
  const matchesActivityType = filterActivityType === "all" || 
    task.activity_type?.id === filterActivityType;

  // Sector filter (always applies in sector context)
  const matchesSector = !currentSector?.id || 
    (currentSector.id === "vendas" && (
      task.activity_type?.sector_id === "vendas" || 
      (task.deal_id && !task.activity_type?.sector_id)
    )) ||
    (currentSector.id === "operacoes" && (
      task.activity_type?.sector_id === "operacoes" ||
      (task.client_id && !task.deal_id && !task.activity_type?.sector_id)
    ));

  return matchesSearch && matchesUser && matchesActivityType && matchesSector;
}), [tasks, searchTerm, filterUser, filterActivityType, currentUser?.id, currentSector?.id]);
```

### 2. Atualizar `statusCounts` para usar `baseFilteredTasks`

```tsx
const statusCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  customStatuses.forEach(status => {
    counts[status.id] = baseFilteredTasks.filter(t => {
      if (t.custom_status_id === status.id) return true;
      if (!t.custom_status_id && t.completed_at && status.is_completed_status) return true;
      return false;
    }).length;
  });
  return counts;
}, [baseFilteredTasks, customStatuses]);
```

### 3. Atualizar Contadores dos Cards para usar `baseFilteredTasks`

```tsx
const { pendingCount, overdueCount, inProgressCount, doneCount } = useMemo(() => {
  const pendingStatus = customStatuses.find(s => s.name.toLowerCase().includes('pendente'));
  const inProgressStatus = customStatuses.find(s => s.name.toLowerCase().includes('andamento'));
  const doneStatus = customStatuses.find(s => s.is_completed_status);
  
  const pendingCount = baseFilteredTasks.filter(t => 
    t.custom_status_id === pendingStatus?.id || 
    (!t.custom_status_id && pendingStatus?.is_default)
  ).length;
  
  const inProgressCount = baseFilteredTasks.filter(t => 
    t.custom_status_id === inProgressStatus?.id
  ).length;
  
  const doneCount = baseFilteredTasks.filter(t => 
    t.custom_status_id === doneStatus?.id || t.completed_at !== null
  ).length;
  
  const completedStatusIds = customStatuses.filter(s => s.is_completed_status).map(s => s.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCount = baseFilteredTasks.filter(t => {
    const isTaskCompleted = t.completed_at !== null || completedStatusIds.includes(t.custom_status_id || '');
    if (!t.due_date || isTaskCompleted) return false;
    const dueDate = new Date(t.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  }).length;

  return { pendingCount, overdueCount, inProgressCount, doneCount };
}, [baseFilteredTasks, customStatuses]);
```

### 4. Simplificar `filteredTasks` (reutiliza `baseFilteredTasks`)

```tsx
// Final filtered tasks - applies tab filter on top of base filters
const filteredTasks = useMemo(() => baseFilteredTasks.filter((task) => {
  const defaultStatus = customStatuses.find(s => s.is_default);
  const targetStatus = activeTab ? customStatuses.find(s => s.id === activeTab) : null;
  
  if (!activeTab) return true;
  
  if (task.custom_status_id === activeTab) return true;
  if (!task.custom_status_id && activeTab === defaultStatus?.id) return true;
  if (!task.custom_status_id && task.completed_at && targetStatus?.is_completed_status) return true;
  
  return false;
}), [baseFilteredTasks, activeTab, customStatuses]);
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Tasks.tsx` | Adicionar `baseFilteredTasks` e atualizar dependências |

---

## Resultado Esperado

| Filtro Aplicado | Cards Mostram |
|-----------------|---------------|
| Nenhum | Total do setor atual |
| Buscar "Follow Up" | Apenas tarefas que correspondem à busca |
| Filtro "Meus" | Apenas tarefas atribuídas ao usuário |
| Tipo "Ligação" | Apenas tarefas do tipo Ligação |
| Combinação | Interseção de todos os filtros |

Os cards serão **totalmente dinâmicos**, refletindo exatamente o contexto de filtros aplicados no momento.

