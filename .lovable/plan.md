

## Adicionar Grafico de Barras Horizontal

### O que sera feito

Adicionar um novo tipo de visualizacao **"Barras Horizontal"** ao modal de criacao de visuais e ao sistema de renderizacao. Esse grafico exibe as categorias no eixo Y e os valores no eixo X (como no exemplo "Canal de Venda"), ideal para comparar categorias com nomes longos.

### Arquivos afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/visual-builder/types.ts` | Adicionar `'bar_horizontal'` ao tipo `ChartType` e ao array `CHART_TYPE_OPTIONS` |
| `src/components/insights/AddVisualModal.tsx` | Adicionar opcao "Barras Horizontal" ao array `CHART_TYPES` com icone adequado |
| `src/components/insights/visuals/ConfigurableChart.tsx` | Adicionar case `'bar_horizontal'` no switch e criar componente `HorizontalBarChartView` usando Recharts `BarChart` com `layout="vertical"` |
| `src/components/insights/visual-builder/ChartTypeSelector.tsx` | Adicionar mapeamento de icone para `bar_horizontal` no `ICON_MAP` |

### Detalhes tecnicos

**1. types.ts**
- `ChartType` passa a incluir `'bar_horizontal'`
- Nova entrada em `CHART_TYPE_OPTIONS`: `{ value: 'bar_horizontal', label: 'Barras Horizontal' }`

**2. AddVisualModal.tsx**
- Nova entrada em `CHART_TYPES`: `{ value: "bar_horizontal", label: "Barras Horizontal", description: "Barras na horizontal para categorias", icon: BarChart3 }` (icone rotacionado via CSS `rotate-90`)
- O fluxo de 3 etapas (formato, metrica, agrupamento) sera identico ao do grafico de barras normal

**3. ConfigurableChart.tsx**
- Novo componente `HorizontalBarChartView` usando `<BarChart layout="vertical">` do Recharts
- O eixo X exibe valores (numerico) e o eixo Y exibe categorias (nomes)
- Barras com `radius={[0, 4, 4, 0]}` (cantos arredondados a direita)
- Labels de valor exibidos a direita das barras
- Margem esquerda maior para acomodar nomes de categorias

**4. ChartTypeSelector.tsx**
- Adicionar `bar_horizontal` ao `ICON_MAP` usando `BarChart3` (com rotacao aplicada no componente)

