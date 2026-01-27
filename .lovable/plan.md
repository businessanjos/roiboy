

# Plano: Corrigir Faturamento para Somar Apenas Negócios Ganhos

## Problema Identificado

O Scorecard de "Faturamento" está exibindo **R$ 36.536.800** somando **todos os 479 negócios**, quando deveria somar apenas os negócios com `status = 'won'` (ganhos).

### Causa Raiz

No `useVisualData.ts`, a lógica de filtragem para Scorecards (`dimension.field === '_total'`) não considera o tipo de métrica sendo calculada:

| Métrica | Filtro Necessário | Situação Atual |
|---------|-------------------|----------------|
| Faturamento | `status = 'won'` | Nenhum filtro |
| Negócios | Nenhum | OK |
| Ticket Médio | `status = 'won'` | Nenhum filtro |
| Perdas | `status = 'lost'` | Nenhum filtro |

O problema é que a configuração do Scorecard não carrega qual métrica está sendo usada - apenas `measure.field = 'value'` e `aggregation = 'sum'`. Isso não é suficiente para determinar que deve filtrar apenas negócios ganhos.

---

## Solucao Proposta

### Abordagem: Adicionar campo `statusFilter` na config do Scorecard

Adicionar um campo opcional `statusFilter` no `VisualConfig` que indica qual status de deal filtrar. Isso é configurado no momento da criação baseado na métrica selecionada.

| Métrica | statusFilter |
|---------|--------------|
| `revenue` | `'won'` |
| `avg_ticket` | `'won'` |
| `lost_reasons` | `'lost'` |
| `deals_count` | `undefined` (todos) |
| `conversion` | `undefined` (todos) |

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/visual-builder/types.ts` | Adicionar `statusFilter?: 'won' \| 'lost' \| 'open'` em `VisualConfig` |
| `src/hooks/useVisualData.ts` | Aplicar filtro de status baseado em `config.statusFilter` |
| `src/components/insights/AddVisualModal.tsx` | Configurar `statusFilter` correto para cada metrica |

---

## Resultado Esperado

```text
ANTES (Errado)
┌─────────────────┐
│   Faturamento   │
│  R$ 36.536.800  │  ← Soma TODOS os deals
│  479 registros  │
└─────────────────┘

DEPOIS (Correto)
┌─────────────────┐
│   Faturamento   │
│   R$ 2.500.000  │  ← Soma apenas deals GANHOS
│   35 registros  │
└─────────────────┘
```

---

## Secao Tecnica

### 1. types.ts - Adicionar statusFilter

```typescript
export interface VisualConfig {
  dataSource: DataSource;
  measure: {
    field: string;
    aggregation: AggregationType;
  };
  dimension: {
    field: string;
    type: 'date' | 'text';
    dateGrouping?: DateGrouping;
  };
  formatting: {
    type: FormatType;
    decimals: number;
    displayScale?: DisplayScale;
  };
  appearance?: VisualAppearance;
  statusFilter?: 'won' | 'lost' | 'open'; // NOVO: Filtro de status para deals
}
```

### 2. useVisualData.ts - Aplicar filtro de status

```typescript
async function fetchDealsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat,
  statusFilter?: 'won' | 'lost' | 'open' // Novo parametro
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('deals')
    .select(`...`)
    .eq('account_id', accountId);

  // NOVO: Aplicar filtro de status se especificado
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  // Determinar campo de data para filtros
  const dateFilterField = dimension.type === 'date' && dimension.field 
    ? dimension.field 
    : statusFilter === 'won' 
      ? 'won_at'  // Para faturamento, filtrar por won_at
      : statusFilter === 'lost'
        ? 'lost_at' // Para perdas, filtrar por lost_at
        : 'created_at';

  // ... resto da logica
}
```

Na chamada da funcao, passar o `statusFilter` do config:

```typescript
// Na funcao useVisualData
switch (dataSource) {
  case 'deals':
    result = await fetchDealsData(
      currentUser.account_id, 
      measure, 
      dimension, 
      filters, 
      dateDisplayFormat,
      config.statusFilter // Passar o filtro de status
    );
    break;
}
```

### 3. AddVisualModal.tsx - Configurar statusFilter por metrica

```typescript
// Mapping atualizado para incluir statusFilter
const METRIC_TO_CONFIG: Record<Metric, { 
  dataSource: 'deals'; 
  measureField: string | null; 
  aggregation: 'sum' | 'count' | 'avg'; 
  formatType: 'currency' | 'decimal' | 'percentage';
  statusFilter?: 'won' | 'lost'; // NOVO
}> = {
  revenue: { 
    dataSource: 'deals', 
    measureField: 'value', 
    aggregation: 'sum', 
    formatType: 'currency',
    statusFilter: 'won' // Apenas negocios ganhos
  },
  deals_count: { 
    dataSource: 'deals', 
    measureField: null, 
    aggregation: 'count', 
    formatType: 'decimal'
    // Sem statusFilter = todos os deals
  },
  avg_ticket: { 
    dataSource: 'deals', 
    measureField: 'value', 
    aggregation: 'avg', 
    formatType: 'currency',
    statusFilter: 'won' // Apenas negocios ganhos
  },
  conversion: { 
    dataSource: 'deals', 
    measureField: null, 
    aggregation: 'count', 
    formatType: 'percentage'
    // Sem statusFilter = calculo feito de outra forma
  },
  lost_reasons: { 
    dataSource: 'deals', 
    measureField: null, 
    aggregation: 'count', 
    formatType: 'decimal',
    statusFilter: 'lost' // Apenas negocios perdidos
  },
};

// Na criacao do config (handleCreate)
if (chartType === 'scorecard') {
  config = {
    dataSource: metricConfig.dataSource,
    measure: { ... },
    dimension: { field: '_total', type: 'text' },
    formatting: { ... },
    appearance: DEFAULT_APPEARANCE,
    statusFilter: metricConfig.statusFilter, // NOVO
  };
}
```

---

## Migracao de Scorecards Existentes

Para Scorecards ja criados sem o `statusFilter`, precisamos de uma logica de fallback inteligente:

```typescript
// Em useVisualData.ts, ao detectar scorecard de faturamento sem statusFilter
// Inferir o statusFilter baseado no measure
function inferStatusFilter(measure: VisualConfig['measure'], dimension: VisualConfig['dimension']): 'won' | 'lost' | undefined {
  if (dimension.field !== '_total') return undefined;
  
  // Se esta somando 'value', provavelmente e faturamento = deals ganhos
  if (measure.field === 'value' && measure.aggregation === 'sum') {
    return 'won';
  }
  if (measure.field === 'value' && measure.aggregation === 'avg') {
    return 'won';
  }
  
  return undefined;
}
```

Isso garante que Scorecards existentes funcionem corretamente mesmo sem atualizar seus configs no banco.

