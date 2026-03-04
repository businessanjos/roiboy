

## Correção: Gráfico mudou de vertical para horizontal

### Causa raiz

Quando forçamos `effectiveChartType = 'bar_stacked'` para visuais com segmentação ativa, o `StackedHorizontalBarChart` usa `visualConfig?.chartOrientation || 'horizontal'` como orientação padrão. O gráfico original era vertical (`bar`), mas como `chartOrientation` não está definido no config, o fallback `'horizontal'` é aplicado.

### Solução

Em `ConfigurableVisualCard.tsx`, quando o `effectiveChartType` é forçado para `'bar_stacked'`, injetar a orientação correta no `visualConfig` baseado no `chartType` original:

- `chartType === 'bar'` → orientação `'vertical'`
- `chartType === 'bar_horizontal'` → orientação `'horizontal'`

```typescript
// Ao montar visualConfig para ConfigurableChart:
const effectiveVisualConfig = isStacked && effectiveChartType === 'bar_stacked' && !config.chartOrientation
  ? { ...config, chartOrientation: chartType === 'bar' ? 'vertical' : 'horizontal' }
  : config;
```

### Arquivo afetado
- `src/components/insights/visuals/ConfigurableVisualCard.tsx`

