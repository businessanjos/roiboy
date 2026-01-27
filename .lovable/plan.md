
# Plano: Corrigir Cálculo da Taxa de Conversão nos Visuais

## Diagnóstico do Problema

### O Que Está Acontecendo

O scorecard de "Conversão" mostra **486.0%** com **486 registros**, quando deveria mostrar algo como **30-40%** (percentual de leads convertidos em ganhos).

### Causa Raiz

| Sistema | Cálculo | Status |
|---------|---------|--------|
| **`useInsightsData.tsx`** (widgets antigos) | `(won / total) × 100` | ✅ Correto |
| **`useVisualData.ts`** (visuais novos) | Contagem simples de registros | ❌ Incorreto |

Quando um visual de "Conversão" é criado pelo `AddVisualModal`, a configuração é:
```ts
conversion: { 
  dataSource: 'deals', 
  measureField: null, 
  aggregation: 'count',  // ← Simplesmente conta registros
  formatType: 'percentage' 
}
```

O `useVisualData.ts` recebe essa configuração e executa uma contagem simples, resultando em `486` registros exibidos como `486%`.

### Fórmula Correta

```text
Taxa de Conversão = (Deals GANHOS no período / Total de Deals CRIADOS no período) × 100
```

## Solução Proposta

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/insights/visual-builder/types.ts` | Adicionar tipo de agregação `'conversion_rate'` |
| `src/components/insights/AddVisualModal.tsx` | Configurar métrica de conversão com nova agregação |
| `src/hooks/useVisualData.ts` | Implementar lógica de cálculo de taxa de conversão |

### 1. Atualizar Tipos (`types.ts`)

Adicionar um novo tipo de agregação especial para taxa de conversão:

```typescript
export type Aggregation = 'sum' | 'avg' | 'count' | 'conversion_rate';
```

### 2. Atualizar Modal de Criação (`AddVisualModal.tsx`)

Modificar a configuração da métrica `conversion`:

```typescript
const METRIC_TO_CONFIG: Record<Metric, {...}> = {
  // ...
  conversion: { 
    dataSource: 'deals', 
    measureField: null, 
    aggregation: 'conversion_rate',  // ← Nova agregação especial
    formatType: 'percentage' 
  },
  // ...
};
```

### 3. Implementar Lógica no Hook (`useVisualData.ts`)

Adicionar tratamento especial para `aggregation: 'conversion_rate'`:

```typescript
// Na função fetchDealsData:
if (measure.aggregation === 'conversion_rate') {
  return await calculateConversionRate(accountId, filters);
}

// Nova função:
async function calculateConversionRate(
  accountId: string,
  filters: any
): Promise<AggregatedDataPoint[]> {
  // 1. Contar TOTAL de deals criados no período
  let totalQuery = supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .gte('created_at', filters.startDate)
    .lte('created_at', filters.endDate);

  // 2. Contar deals GANHOS no período
  let wonQuery = supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('status', 'won')
    .not('won_at', 'is', null)
    .gte('won_at', filters.startDate)
    .lte('won_at', filters.endDate);

  // Aplicar filtro de usuário se necessário
  if (filters.userId && filters.userId !== 'all') {
    totalQuery = totalQuery.eq('responsible_user_id', filters.userId);
    wonQuery = wonQuery.eq('responsible_user_id', filters.userId);
  }

  const [{ count: total }, { count: won }] = await Promise.all([totalQuery, wonQuery]);

  // 3. Calcular taxa de conversão
  const rate = (total && total > 0) 
    ? ((won || 0) / total) * 100 
    : 0;

  return [{ 
    name: 'Total', 
    value: Number(rate.toFixed(1)), 
    count: total || 0 
  }];
}
```

### 4. Tratar Agrupamentos Temporais (Opcional)

Para gráficos de linha/barra com conversão por mês:

```typescript
async function calculateConversionRateByPeriod(
  accountId: string,
  filters: any,
  dateGrouping: 'month' | 'week' | 'day'
): Promise<AggregatedDataPoint[]> {
  // Buscar todos os deals
  const { data: allDeals } = await supabase
    .from('deals')
    .select('id, status, created_at, won_at')
    .eq('account_id', accountId)
    .gte('created_at', filters.startDate)
    .lte('created_at', filters.endDate);

  // Agrupar por período
  const periods = new Map<string, { total: number; won: number }>();

  for (const deal of allDeals || []) {
    const periodKey = formatDateGroup(deal.created_at, dateGrouping);
    
    if (!periods.has(periodKey)) {
      periods.set(periodKey, { total: 0, won: 0 });
    }
    
    const period = periods.get(periodKey)!;
    period.total++;
    
    if (deal.status === 'won') {
      period.won++;
    }
  }

  // Calcular taxa por período
  return Array.from(periods.entries()).map(([name, { total, won }]) => ({
    name,
    value: total > 0 ? (won / total) * 100 : 0,
    count: total
  }));
}
```

## Fluxo Visual Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│                   ANTES (INCORRETO)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────┐                                       │
│   │   Conversão     │                                       │
│   │                 │                                       │
│   │    486.0%       │  ← Contagem simples (486 registros)   │
│   │   486 registros │                                       │
│   └─────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   DEPOIS (CORRETO)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────┐                                       │
│   │   Conversão     │                                       │
│   │                 │                                       │
│   │    32.5%        │  ← (158 ganhos / 486 total) × 100     │
│   │   486 negócios  │                                       │
│   └─────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

### Scorecard de Conversão

| Métrica | Antes | Depois |
|---------|-------|--------|
| **Valor Exibido** | 486.0% | ~32.5% (exemplo) |
| **Significado** | Contagem de registros | Taxa real de conversão |
| **Legenda** | 486 registros | 486 negócios |

### Fórmula Aplicada

```text
Taxa = (Deals Ganhos ÷ Total de Deals) × 100
Exemplo: (158 ÷ 486) × 100 = 32.5%
```

## Detalhes Técnicos

### Fluxo de Dados

```text
1. AddVisualModal
   └── Define aggregation: 'conversion_rate'

2. useVisualData
   └── fetchDealsData()
       ├── Detecta aggregation === 'conversion_rate'
       └── Chama calculateConversionRate()
           ├── Query 1: COUNT(*) FROM deals (total criados)
           ├── Query 2: COUNT(*) FROM deals WHERE status = 'won'
           └── Return: (won/total) × 100
```

### Compatibilidade

- **Visuais existentes** com configuração antiga continuarão funcionando
- **Novos visuais** de conversão usarão a lógica correta automaticamente
- **Visuais antigos** precisam ser recriados para usar a nova lógica
