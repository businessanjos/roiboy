

## Grafico de Barras Horizontal Empilhado (Stacked) com visualizacao diaria

### Resumo

Criar um novo tipo de grafico **"Barras Empilhadas"** (`bar_stacked`) que exibe dados diarios com barras horizontais empilhadas por vendedor, similar ao grafico da imagem de referencia (eixo Y = dias do mes, eixo X = valores, barras coloridas por vendedor com legenda).

### Desafio tecnico

O sistema atual usa uma estrutura de dados plana (`AggregatedDataPoint[]`) com um unico `value` por grupo. O grafico empilhado precisa de dados multi-serie, onde cada linha tem um campo por vendedor. Exemplo:

```text
Estrutura atual:     { name: "Dia 6", value: 526000 }
Estrutura empilhada: { name: "6", "Everton Pieri": 370000, "Jonathan Marcato": 156000 }
```

### Mudancas

**1. `src/components/insights/visual-builder/types.ts`**
- Adicionar `bar_stacked` ao tipo `ChartType`
- Adicionar opcao em `CHART_TYPE_OPTIONS`

**2. `src/components/insights/visual-builder/ChartTypeSelector.tsx`**
- Adicionar icone para `bar_stacked` no `ICON_MAP`

**3. `src/components/insights/AddVisualModal.tsx`**
- Adicionar `bar_stacked` como tipo de grafico disponivel na lista `CHART_TYPES`
- Para este tipo, o modal tera 3 passos: tipo, metrica e agrupamento
- Quando selecionado, o visual sera configurado com agrupamento diario e uma nova propriedade `stackBy: 'responsible_name'` no config

**4. `src/components/insights/visual-builder/types.ts` (VisualConfig)**
- Adicionar campo opcional `stackBy?: string` ao `VisualConfig` para indicar a segunda dimensao de empilhamento

**5. `src/hooks/useVisualData.ts`**
- Criar nova interface `StackedDataPoint` com campos dinamicos (um campo por serie/vendedor)
- Criar funcao `fetchStackedDealsData` que:
  - Busca deals agrupados por dia
  - Agrupa os valores por vendedor dentro de cada dia
  - Retorna dados no formato `{ name: "1", "Vendedor A": 71000, "Vendedor B": 156000, ... }`
- Exportar separadamente um hook `useStackedVisualData` ou extender `useVisualData` para retornar dados empilhados quando `stackBy` estiver presente

**6. `src/components/insights/visuals/ConfigurableChart.tsx`**
- Importar `Legend` do recharts
- Adicionar case `bar_stacked` no switch que renderiza o `StackedHorizontalBarChart`
- Criar componente `StackedHorizontalBarChart` que:
  - Usa `BarChart` com `layout="vertical"` e `stackId="stack"` em cada `<Bar>`
  - Eixo Y mostra os dias (1-31) do mes
  - Eixo X mostra valores formatados
  - Uma `<Bar>` por vendedor, cada um com sua cor
  - Legenda no topo com nome dos vendedores
  - Labels dentro das barras mostrando valores compactos (ex: "R$ 71 Mil")

**7. `src/components/insights/visuals/ConfigurableVisualCard.tsx`**
- Passar dados empilhados para o `ConfigurableChart` quando o tipo for `bar_stacked`
- Utilizar o hook de dados empilhados quando `config.stackBy` estiver presente

### Fluxo de dados

```text
AddVisualModal (selecao)
  -> config: { dataSource: 'deals', measure: { field: 'value', aggregation: 'sum' },
       dimension: { field: 'won_at', type: 'date', dateGrouping: 'day' },
       stackBy: 'responsible_name', statusFilter: 'won' }
  -> useVisualData detecta stackBy
  -> fetchStackedDealsData retorna [{ name: "1", "Vendedor A": X, "Vendedor B": Y }, ...]
  -> StackedHorizontalBarChart renderiza com <Bar> por vendedor
```

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `types.ts` | Novo tipo `bar_stacked`, campo `stackBy` no VisualConfig |
| `ChartTypeSelector.tsx` | Icone para novo tipo |
| `AddVisualModal.tsx` | Opcao "Barras Empilhadas" no wizard |
| `useVisualData.ts` | Funcao de busca de dados empilhados |
| `ConfigurableChart.tsx` | Componente `StackedHorizontalBarChart` |
| `ConfigurableVisualCard.tsx` | Integracao com dados empilhados |

