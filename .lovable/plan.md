
## Corrigir filtro de datas no visual "Calls Comerciais"

### Problema raiz

O campo `due_date` na tabela `internal_tasks` e do tipo `date` (nao `timestamp`). Os filtros do Insights passam timestamps ISO completos como `2026-02-01T03:00:00.000Z`. A API REST do banco pode nao converter corretamente esse timestamp para comparacao com uma coluna `date`, fazendo com que o filtro seja ignorado e todos os registros sejam retornados.

**Prova:** Os numeros exibidos (Jonathan: 6/46, Darlan: 6/36, Vanessa: 1/10) coincidem exatamente com os totais historicos sem filtro de data.

### Solucao

Converter os timestamps ISO para formato de data pura (`YYYY-MM-DD`) antes de aplicar filtros na coluna `due_date`. Isso garante compatibilidade com o tipo da coluna.

### Detalhes tecnicos

**Arquivo 1:** `src/hooks/useVisualData.ts`

Na funcao `fetchTasksCallCommercialData` (~linha 822), converter os filtros:

```text
// ANTES (pode falhar com coluna date):
if (filters.startDate) baseQuery = baseQuery.gte('due_date', filters.startDate);
if (filters.endDate) baseQuery = baseQuery.lte('due_date', filters.endDate);

// DEPOIS (formato compativel com coluna date):
if (filters.startDate) {
  const startDate = filters.startDate.split('T')[0];
  baseQuery = baseQuery.gte('due_date', startDate);
}
if (filters.endDate) {
  const endDate = filters.endDate.split('T')[0];
  baseQuery = baseQuery.lte('due_date', endDate);
}
```

**Arquivo 2:** `src/hooks/useVisualDrilldown.ts`

Na funcao `fetchTasksRecords` (~linha 262), aplicar a mesma conversao:

```text
if (filters.startDate) {
  const startDate = filters.startDate.split('T')[0];
  baseQuery = baseQuery.gte('due_date', startDate);
}
if (filters.endDate) {
  const endDate = filters.endDate.split('T')[0];
  baseQuery = baseQuery.lte('due_date', endDate);
}
```

### Dados esperados com filtro "Este Mes" (Fevereiro 2026)

| Vendedor | Agendadas (abertas) | Concluidas |
|----------|---------------------|------------|
| Jonathan Marcato | 3 | 12 |
| Darlan Ferreira | 5 | 14 |
| Vanessa Minelli | 1 | 2 |

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useVisualData.ts` | Converter ISO para YYYY-MM-DD nos filtros de `due_date` |
| `src/hooks/useVisualDrilldown.ts` | Mesma conversao nos filtros de `due_date` do drilldown |
