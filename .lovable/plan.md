

# Plano: Scorecard sem Passo de Agrupamento

## Problema Identificado

Ao criar um visual do tipo "Scorecard", o sistema exibe um terceiro passo pedindo "Como agrupar os dados?". Isso é incorreto porque Scorecards devem exibir **um único valor agregado** baseado nos filtros ativos, sem necessidade de agrupamento.

| Visual | Comportamento Esperado |
|--------|----------------------|
| Gráfico de Barras/Linhas/Pizza | Precisa de agrupamento (eixo X) |
| Scorecard | Apenas valor total, sem agrupamento |

---

## Solução Proposta

### 1. Ajustar Fluxo do Modal para Scorecards

**Arquivo:** `src/components/insights/AddVisualModal.tsx`

Quando o tipo selecionado for "scorecard", o modal terá apenas **2 passos**:
- Passo 1: Escolher formato
- Passo 2: Escolher métrica + título (e criar)

```text
FLUXO ATUAL (3 passos para todos)
┌───────────┐   ┌────────────┐   ┌──────────────┐
│ 1. Formato│ → │ 2. Métrica │ → │ 3. Agrupamento│
└───────────┘   └────────────┘   └──────────────┘

FLUXO NOVO (2 passos para Scorecard)
┌───────────┐   ┌───────────────────┐
│ 1. Formato│ → │ 2. Métrica + Criar│  ← Scorecard termina aqui
└───────────┘   └───────────────────┘

FLUXO NOVO (3 passos para Gráficos)
┌───────────┐   ┌────────────┐   ┌──────────────┐
│ 1. Formato│ → │ 2. Métrica │ → │ 3. Agrupamento│
└───────────┘   └────────────┘   └──────────────┘
```

### 2. Criar Config Sem Dimensão para Scorecards

Scorecards usarão uma configuração especial onde `dimension` indica agregação global:

```typescript
// Config para Scorecard (sem agrupamento real)
const config: VisualConfig = {
  dataSource: 'deals',
  measure: { field: 'value', aggregation: 'sum' },
  dimension: { 
    field: '_total',  // Marcador especial: agregação global
    type: 'text' 
  },
  formatting: { type: 'currency', decimals: 2 },
};
```

### 3. Ajustar Busca de Dados para Scorecards

**Arquivo:** `src/hooks/useVisualData.ts`

Quando `dimension.field === '_total'`, retornar um único ponto de dados com o valor agregado de todos os registros:

```typescript
// Se dimension._total, não agrupa - retorna total geral
if (dimension.field === '_total') {
  const totalValue = calculateTotalValue(data, measure);
  return [{ name: 'Total', value: totalValue, count: data.length }];
}
```

### 4. Gerar Título Automaticamente para Scorecards

O título será baseado apenas na métrica, sem "por X":
- "Faturamento Total"
- "Quantidade de Negócios"
- "Ticket Médio"

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/insights/AddVisualModal.tsx` | Lógica condicional de passos para scorecard (2 vs 3) |
| `src/hooks/useVisualData.ts` | Suporte a `dimension.field === '_total'` |

---

## Resultado Esperado

1. Usuário seleciona "Scorecard" no passo 1
2. Passo 2 mostra opções de métricas + campo de título
3. Botão "Criar" aparece diretamente no passo 2 (não há passo 3)
4. Scorecard criado exibe o valor total da métrica para o período filtrado

---

## Seção Tecnica

### Alteracoes em AddVisualModal.tsx

```typescript
// Determinar numero total de passos baseado no tipo
const totalSteps = chartType === 'scorecard' ? 2 : 3;

// Ajustar titulo do header
<span>- Passo {step} de {totalSteps}</span>

// No passo 2, se for scorecard, mostrar campo de titulo
{step === 2 && (
  <div className="space-y-4">
    <p>O que você quer medir?</p>
    <RadioGroup ...>
      {METRICS.map(...)}
    </RadioGroup>
    
    {/* Mostrar titulo apenas para scorecards no passo 2 */}
    {chartType === 'scorecard' && (
      <div className="space-y-2">
        <Label>Título do Visual</Label>
        <Input value={title} onChange={...} />
      </div>
    )}
  </div>
)}

// Ajustar navegacao
// Se scorecard e step 2 -> mostrar botao Criar (nao Proximo)
{step < totalSteps ? (
  <Button onClick={handleNext}>Próximo</Button>
) : (
  <Button onClick={handleCreate}>Criar</Button>
)}

// Ajustar auto-geracao de titulo para scorecards (sem "por X")
useEffect(() => {
  if (chartType === 'scorecard' && metric) {
    setTitle(METRIC_LABELS[metric]); // Ex: "Faturamento"
  } else if (metric && groupBy) {
    setTitle(`${METRIC_LABELS[metric]} ${GROUP_LABELS[groupBy]}`);
  }
}, [chartType, metric, groupBy]);

// handleCreate - config sem agrupamento para scorecards
const handleCreate = async () => {
  // Para scorecard, nao precisa de groupBy
  if (chartType === 'scorecard') {
    const config: VisualConfig = {
      dataSource: 'deals',
      measure: { field: metricConfig.measureField || '', aggregation: metricConfig.aggregation },
      dimension: { field: '_total', type: 'text' }, // Agregacao global
      formatting: { type: metricConfig.formatType, decimals: ... },
    };
    // ... criar visual
  }
};

// Ajustar validacao
const canCreate = chartType === 'scorecard'
  ? metric !== null && title.trim() !== '' && activeDashboardId !== null
  : groupBy !== null && title.trim() !== '' && activeDashboardId !== null;
```

### Alteracoes em useVisualData.ts

```typescript
// Em fetchDealsData, fetchLeadsData, etc.
async function fetchDealsData(...) {
  // Buscar dados aplicando filtros de data e outros
  const { data, error } = await query;
  
  // Se dimension._total, retornar agregacao global
  if (dimension.field === '_total') {
    return aggregateGlobalTotal(data, measure);
  }
  
  // Caso contrario, agregar por dimensao normalmente
  return aggregateData(data, measure, dimension, dateDisplayFormat);
}

function aggregateGlobalTotal(
  data: any[], 
  measure: VisualConfig['measure']
): AggregatedDataPoint[] {
  let value: number;
  
  switch (measure.aggregation) {
    case 'count':
      value = data.length;
      break;
    case 'sum':
      value = data.reduce((acc, item) => {
        const val = getMeasureValue(item, measure.field);
        return acc + (val || 0);
      }, 0);
      break;
    case 'avg':
      const total = data.reduce((acc, item) => {
        const val = getMeasureValue(item, measure.field);
        return acc + (val || 0);
      }, 0);
      value = data.length > 0 ? total / data.length : 0;
      break;
    default:
      value = 0;
  }
  
  return [{ name: 'Total', value, count: data.length }];
}
```

