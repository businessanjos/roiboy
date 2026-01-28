

# Plano: Correção de Visuais do Insights (Layout, Faturamento e "Sem Responsável")

## Problemas Identificados

### 1. "Sem Responsável" aparece nos gráficos de vendedores
Os visuais agrupados por vendedor mostram uma categoria "Sem Responsável" para negócios sem usuário atribuído.

### 2. Faturamento por Vendedor está incorreto
O gráfico está somando TODOS os negócios (abertos, perdidos e ganhos), quando deveria mostrar apenas o valor dos negócios GANHOS.

**Causa raiz**: No `AddVisualModal.tsx`, a propriedade `statusFilter` está sendo passada apenas para scorecards (linha 182), mas NÃO para gráficos (linhas 195-215):

```typescript
// Scorecards - statusFilter É passado ✅
config = {
  ...
  statusFilter: metricConfig.statusFilter,
};

// Charts - statusFilter NÃO é passado ❌
config = {
  ...
  // statusFilter está faltando!
};
```

### 3. Layout do grid limitado e inflexível
O `react-grid-layout` está usando compactação automática (`verticalCompactor` por padrão), que reorganiza os itens automaticamente, causando sobreposição e dificultando o posicionamento livre.

## Solução Proposta

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useVisualData.ts` | Filtrar "Sem Responsável" de visuais por vendedor |
| `src/components/insights/AddVisualModal.tsx` | Passar `statusFilter` para gráficos (não apenas scorecards) |
| `src/components/insights/grid/InsightsGrid.tsx` | Usar `noCompactor` para posicionamento livre |

### 1. Remover "Sem Responsável" dos Visuais

Na função `aggregateData` em `useVisualData.ts`, filtrar resultados onde o nome é "Sem Responsável" quando o dimension.field é `responsible_name`:

```typescript
// Após o loop de agregação, antes de retornar:
let filteredResult = result;

// Remove "Sem Responsável" from user-based dimensions
if (dimension.field === 'responsible_name') {
  filteredResult = result.filter(item => item.name !== 'Sem Responsável');
}

return filteredResult;
```

### 2. Corrigir Faturamento por Vendedor

No `AddVisualModal.tsx`, adicionar `statusFilter` à configuração de gráficos:

```typescript
// Charts: use groupBy for dimension
config = {
  dataSource: metricConfig.dataSource,
  measure: {
    field: metricConfig.measureField || '',
    aggregation: metricConfig.aggregation,
  },
  dimension: {
    field: dimensionField,
    type: baseDimensionConfig.type,
    ...(baseDimensionConfig.dateGrouping && { dateGrouping: baseDimensionConfig.dateGrouping }),
  },
  formatting: {
    type: metricConfig.formatType,
    decimals: metricConfig.formatType === 'currency' ? 2 : 1,
  },
  appearance: {
    ...DEFAULT_APPEARANCE,
    fillEmptyDates: isTemporalGrouping,
    showDataLabels: isTemporalGrouping,
  },
  statusFilter: metricConfig.statusFilter,  // ← ADICIONAR ESTA LINHA
};
```

Isso garante que:
- "Faturamento por Vendedor" (metric: revenue) → filtra apenas `status = 'won'`
- "Ticket Médio por Vendedor" (metric: avg_ticket) → filtra apenas `status = 'won'`
- "Perdas por Etapa" (metric: lost_reasons) → filtra apenas `status = 'lost'`

### 3. Grid Flexível com Posicionamento Livre

Atualizar `InsightsGrid.tsx` para usar `noCompactor` do `react-grid-layout/core`:

```typescript
import GridLayout from "react-grid-layout";
import { noCompactor } from "react-grid-layout/core";

// Na configuração do GridLayout:
<GridLayout
  className="layout"
  layout={layout}
  width={width}
  onLayoutChange={handleLayoutChange}
  gridConfig={{
    cols: COLS,
    rowHeight: ROW_HEIGHT,
    margin: [8, 8],           // Margens menores
    containerPadding: [0, 0],
  }}
  dragConfig={{
    enabled: true,
    handle: ".widget-drag-handle",
  }}
  resizeConfig={{
    enabled: true,
  }}
  compactor={noCompactor}     // ← Posicionamento livre sem compactação
/>
```

**Benefícios do `noCompactor`**:
- Visuais permanecem exatamente onde você os posiciona
- Sem reorganização automática ao arrastar
- Permite posicionamento livre em qualquer posição do grid
- Visuais não "empurram" outros automaticamente

## Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────┐
│                   ANTES (PROBLEMAS)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │Faturamento│ │Ticket Méd.│ │ Conversão │  ← Cards OK      │
│  │R$3.751.200│ │R$ 117,2K  │ │   6.6%    │                  │
│  └───────────┘ └───────────┘ └───────────┘                  │
│                                                             │
│  ┌──────────────────────────────────────┐                   │
│  │   Faturamento por Vendedor           │  ← SOBREPONDO!    │
│  │   ████████ Vanessa                   │                   │
│  │   ███████ Darlan                     │                   │
│  │   ██████ Jonathan                    │                   │
│  │   █████ George                       │                   │
│  │   ████ Everton                       │                   │
│  │   ███ SEM RESPONSÁVEL ← REMOVER      │                   │
│  └──────────────────────────────────────┘                   │
│                                                             │
│  Valor total = TODOS os deals (errado!)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   DEPOIS (CORRIGIDO)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │Faturamento│ │Ticket Méd.│ │ Conversão │  ← Cards OK      │
│  │R$2.450.000│ │R$ 95,3K   │ │   32.5%   │  (valores reais) │
│  └───────────┘ └───────────┘ └───────────┘                  │
│                                                             │
│  ┌──────────────────────────────────────┐                   │
│  │   Faturamento por Vendedor           │  ← POSICIONÁVEL   │
│  │   ████████ Vanessa                   │    LIVREMENTE     │
│  │   ███████ Darlan                     │                   │
│  │   ██████ Jonathan                    │                   │
│  │   █████ George                       │                   │
│  │   ████ Everton                       │  ← Sem "Sem Resp."|
│  └──────────────────────────────────────┘                   │
│                                                             │
│  Valor = apenas deals GANHOS (correto!)                     │
│  Grid = posicionamento livre, sem sobreposição forçada      │
└─────────────────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### Mudança no Grid

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Compactação** | `verticalCompactor` (padrão) | `noCompactor` |
| **Margens** | `[16, 16]` | `[8, 8]` (menores) |
| **Comportamento** | Itens se reorganizam | Itens ficam onde posicionados |
| **Sobreposição** | Possível ao arrastar | Prevenida naturalmente |

### Mudança no StatusFilter

| Métrica | dataSource | statusFilter | Resultado |
|---------|------------|--------------|-----------|
| revenue | deals | `'won'` | Apenas negócios ganhos |
| avg_ticket | deals | `'won'` | Apenas negócios ganhos |
| deals_count | deals | (nenhum) | Todos os negócios |
| conversion | deals | (cálculo especial) | Taxa de conversão |
| lost_reasons | deals | `'lost'` | Apenas negócios perdidos |

## Visuais Existentes

**Nota importante**: Visuais já criados anteriormente continuarão com a configuração antiga (sem `statusFilter`). Para corrigir visuais existentes, o usuário precisará:

1. Deletar o visual antigo
2. Criar um novo visual com a mesma métrica

Alternativamente, podemos adicionar uma migração para atualizar visuais existentes no banco de dados.

