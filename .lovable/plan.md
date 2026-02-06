
# Plano: Corrigir Filtros de Tarefas Quebrados

## Diagnóstico do Problema

A última alteração que fizemos adicionou o fallback de status apenas na **renderização visual** (linhas 534-538), mas **não corrigiu a lógica de filtragem**. Isso causa uma discrepância:

### Comportamento Atual

| Local | Considera `completed_at`? | Resultado |
|-------|--------------------------|-----------|
| **Contadores (cards)** | ✅ Sim (linha 477) | Mostra 817 concluídas |
| **Contagem das abas** | ❌ Não (linha 459) | Aba mostra contagem errada |
| **Filtragem por aba** | ❌ Não (linha 420-423) | Tarefas legadas não aparecem |
| **Exibição na tabela** | ✅ Sim (linha 535-538) | Mostra status correto |

### Fluxo do Bug

1. Usuário clica na aba "Concluído"
2. `activeTab` = ID do status concluído
3. `filteredTasks` verifica: `task.custom_status_id === activeTab`
4. Tarefas legadas têm `custom_status_id = NULL` → **não correspondem**
5. Resultado: 0 tarefas exibidas, mesmo com 817 no contador

---

## Solução

Aplicar a mesma lógica de fallback em **três lugares**:

### 1. Contagem por Status (linha 456-462)

**Antes:**
```tsx
const statusCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  customStatuses.forEach(status => {
    counts[status.id] = tasks.filter(t => t.custom_status_id === status.id).length;
  });
  return counts;
}, [tasks, customStatuses]);
```

**Depois:**
```tsx
const statusCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  customStatuses.forEach(status => {
    counts[status.id] = tasks.filter(t => {
      // Direct match
      if (t.custom_status_id === status.id) return true;
      // Legacy fallback: tasks with completed_at but no custom_status_id
      if (!t.custom_status_id && t.completed_at && status.is_completed_status) return true;
      return false;
    }).length;
  });
  return counts;
}, [tasks, customStatuses]);
```

### 2. Filtro por Aba (linha 418-423)

**Antes:**
```tsx
const defaultStatus = customStatuses.find(s => s.is_default);
const matchesTab = activeTab 
  ? task.custom_status_id === activeTab || 
    (!task.custom_status_id && activeTab === defaultStatus?.id)
  : true;
```

**Depois:**
```tsx
// Find relevant statuses for filtering
const defaultStatus = customStatuses.find(s => s.is_default);
const targetStatus = activeTab ? customStatuses.find(s => s.id === activeTab) : null;

// Match tab with fallback for legacy completed tasks
let matchesTab = true;
if (activeTab) {
  if (task.custom_status_id === activeTab) {
    matchesTab = true;
  } else if (!task.custom_status_id && activeTab === defaultStatus?.id) {
    // Tasks without status go to default
    matchesTab = true;
  } else if (!task.custom_status_id && task.completed_at && targetStatus?.is_completed_status) {
    // Legacy completed tasks go to completed status tab
    matchesTab = true;
  } else {
    matchesTab = false;
  }
}
```

---

## Arquivo a Modificar

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `src/pages/Tasks.tsx` | 456-462 | Adicionar fallback no `statusCounts` |
| `src/pages/Tasks.tsx` | 418-423 | Adicionar fallback no `matchesTab` |

---

## Resultado Esperado

1. **Aba "Concluído"** mostrará corretamente todas as tarefas:
   - Com `custom_status_id` do status concluído
   - Com `completed_at` preenchido (legadas)

2. **Contadores das abas** refletirão a mesma contagem dos cards

3. **Todas as tarefas** voltarão a aparecer ao aplicar filtros

4. **Experiência consistente** entre a contagem e a visualização real
