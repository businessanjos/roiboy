

## Problema: Drilldown do Scorecard de Faturamento retorna 0 registros

### Causa raiz

O scorecard "Faturamento" é um visual de deals com `measure: { field: 'value', aggregation: 'sum' }` e `dimension: { field: '_total' }`. Existem **duas divergências críticas** entre como o visual principal (`useVisualData`) e o drilldown (`useVisualDrilldown`) buscam os dados:

**1. StatusFilter não é inferido no drilldown**

O visual principal usa `inferStatusFilter()` que detecta `measure.field === 'value'` + `aggregation === 'sum'` e infere `statusFilter = 'won'`. O drilldown só verifica `config.statusFilter` (valor explícito no config). Se o visual não tem `statusFilter` explícito salvo, o drilldown não filtra por status — ou filtra errado.

**2. Campo de data errado no drilldown**

O visual principal, quando `statusFilter === 'won'`, usa `won_at` para filtrar por data. O drilldown ignora essa lógica e sempre usa `created_at` como fallback quando a dimensão não é do tipo `date`. Isso significa que um deal ganho em março mas criado em janeiro **não aparece** quando o filtro de data é "março".

```text
Visual principal (correto):
  statusFilter = 'won' (inferido)
  dateField = 'won_at'
  → Encontra o deal ganho em março ✓

Drilldown (incorreto):
  statusFilter = undefined (não inferido)
  dateField = 'created_at'
  → Filtra por created_at em março → deal foi criado em janeiro → 0 registros ✗
```

### Solução

Aplicar a mesma lógica de inferência e seleção de campo de data no drilldown:

### Alteração — `src/hooks/useVisualDrilldown.ts`

**1. Adicionar a função `inferStatusFilter`** (copiar de `useVisualData.ts`):
```typescript
function inferStatusFilter(
  measure: VisualConfig['measure'], 
  dimension: VisualConfig['dimension']
): 'won' | 'lost' | undefined {
  if (dimension.field !== '_total') return undefined;
  if (measure.field === 'value' && (measure.aggregation === 'sum' || measure.aggregation === 'avg')) {
    return 'won';
  }
  return undefined;
}
```

**2. Em `fetchDealsRecords`**, calcular o `effectiveStatusFilter` e usar na query:
```typescript
const effectiveStatusFilter = config.statusFilter ?? inferStatusFilter(config.measure, config.dimension);

if (effectiveStatusFilter) {
  query = query.eq('status', effectiveStatusFilter);
}
```

**3. Corrigir a seleção do campo de data** para considerar o statusFilter:
```typescript
let dateFilterField: string;
if (config.dimension?.type === 'date' && config.dimension.field) {
  dateFilterField = config.dimension.field;
} else if (effectiveStatusFilter === 'won') {
  dateFilterField = 'won_at';
} else if (effectiveStatusFilter === 'lost') {
  dateFilterField = 'lost_at';
} else {
  dateFilterField = 'created_at';
}
```

### Resultado esperado

- O drilldown do scorecard "Faturamento" vai encontrar exatamente os mesmos deals que o visual principal exibe
- O campo de data correto (`won_at`) será usado para filtrar, garantindo que deals ganhos no período apareçam
- A paridade total entre gráfico e lista de registros é mantida

