

## Corrigir visual "Calls Comerciais": filtros, paginacao e drilldown

### Problemas identificados

1. **Filtros ignorados:** A funcao `fetchTasksCallCommercialData` recebe apenas `accountId` e ignora completamente os filtros de data e usuario aplicados na barra de filtros do Insights.

2. **Limite de 1.000 registros:** A query de tarefas nao tem paginacao, entao contas com muitas tarefas terao dados incompletos.

3. **Drilldown zerado:** O hook `useVisualDrilldown.ts` nao tem `case 'tasks'` no switch — retorna array vazio, resultando em "0 registros" ao explorar dados.

### Solucao

#### 1. Aplicar filtros na funcao de dados (`useVisualData.ts`)

Modificar `fetchTasksCallCommercialData` para receber e aplicar `filters`:

- **Filtro de data:** Aplicar `filters.startDate` e `filters.endDate` sobre o campo `due_date` (ou `created_at`) das tarefas
- **Filtro de usuario:** Aplicar `filters.userId` sobre `assigned_to`
- **Paginacao:** Buscar em lotes de 1.000 ate esgotar resultados

```text
async function fetchTasksCallCommercialData(
  accountId: string,
  filters: any   // <-- ADICIONAR
): Promise<AggregatedDataPoint[]> {
  // ... buscar activity types ...

  // Aplicar filtros
  let baseQuery = supabase
    .from('internal_tasks')
    .select('id, activity_type_id, completed_at, assigned_to, due_date, users!internal_tasks_assigned_to_fkey(name)')
    .eq('account_id', accountId)
    .in('activity_type_id', typeIds)
    .not('assigned_to', 'is', null);

  if (filters.startDate) baseQuery = baseQuery.gte('due_date', filters.startDate);
  if (filters.endDate) baseQuery = baseQuery.lte('due_date', filters.endDate);
  if (filters.userId && filters.userId !== 'all') baseQuery = baseQuery.eq('assigned_to', filters.userId);

  // Paginar
  let allTasks = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await baseQuery.range(from, from + pageSize - 1);
    allTasks = allTasks.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  // ... resto da logica de agrupamento ...
}
```

Atualizar a chamada no switch para passar `filters`:

```text
case 'tasks':
  result = await fetchTasksCallCommercialData(currentUser.account_id, filters);
  break;
```

#### 2. Adicionar drilldown de tarefas (`useVisualDrilldown.ts`)

Adicionar `case 'tasks'` no switch e criar funcao `fetchTasksRecords`:

```text
case 'tasks':
  return fetchTasksRecords(currentUser.account_id, config, filters, groupName);
```

A funcao `fetchTasksRecords` buscara as tarefas com paginacao e as retornara como `DrilldownRecord[]` com campos relevantes (titulo, responsavel, status, data).

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useVisualData.ts` | Adicionar `filters` a `fetchTasksCallCommercialData`, aplicar filtros de data/usuario, paginar |
| `src/hooks/useVisualDrilldown.ts` | Adicionar `case 'tasks'` + funcao `fetchTasksRecords` com paginacao e filtros |

### Resultado esperado

- Os numeros de "Agend." e "Conc." respeitarao os filtros de data/usuario selecionados
- "Explorar Dados" mostrara todos os registros de tarefas (nao mais 0)
- Dados completos sem limite de 1.000 linhas
