

## Correção: Segmentação por campo personalizado não renderiza dados

### Causa raiz

Quando o usuário ativa segmentação por campo personalizado em um gráfico de barras (`bar`):

1. `ConfigurableVisualCard` detecta `isStacked = true` e busca dados via `useStackedVisualData` (desabilitando `useVisualData`)
2. Porém o `chartType` continua como `'bar'` (não muda para `'bar_stacked'`)
3. `ConfigurableChart` recebe `type='bar'` e renderiza `BarChartView` com `data` vazio (pois `useVisualData` foi desabilitado)
4. Os `stackedData` são passados como prop mas ignorados — só são usados no `case 'bar_stacked'`

### Solução

Em `ConfigurableVisualCard`, quando o visual tem segmentação por campo personalizado ativa (`isStacked = true`), forçar o `chartType` efetivo para `'bar_stacked'` antes de passá-lo ao `ConfigurableChart`. Isso garante que o componente correto (`StackedHorizontalBarChart`) seja usado para renderizar os dados segmentados.

```typescript
// ConfigurableVisualCard.tsx
const effectiveChartType = isStacked && chartType === 'bar' ? 'bar_stacked' : chartType;
```

E usar `effectiveChartType` no lugar de `chartType` ao renderizar `ConfigurableChart`.

### Arquivo afetado
- `src/components/insights/visuals/ConfigurableVisualCard.tsx` — mapear chartType para `bar_stacked` quando segmentação está ativa

