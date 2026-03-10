

## Dois ajustes no Funil de Insights

### Problema 1: Barras com largura incorreta
O `min-width: 15%` no `ConfigurableFunnel.tsx` é muito alto. Quando o valor máximo cumulativo é 70 e uma etapa tem cumulativo 8 (11%), ela é forçada a 15%, ficando igual a etapas com cumulativo 4, 6, 10 etc. Todas parecem ter o mesmo tamanho.

**Correção**: Reduzir o `min-width` de 15% para 8% (e `minWidth` de `200px` para `120px`) tanto nas barras regulares quanto na barra de Ganhos. Isso preserva a legibilidade mínima mas permite diferenciar visualmente etapas com volumes diferentes.

### Problema 2: "Categorias Visíveis" mostra apenas 4 etapas
O `VisualQuickSettings` chama `useVisualData({ config })` sem passar `chartType`. O backfill de etapas vazias (linhas 81-127 de `useVisualData.ts`) só executa quando `chartType === 'funnel'`. Sem esse parâmetro, apenas etapas com negócios reais são retornadas, e "Ganhos" também não aparece.

**Correção**: Passar `chartType: visual.chart_type` na chamada de `useVisualData` dentro de `VisualQuickSettings.tsx`.

### Arquivos alterados

**1. `src/components/insights/visuals/ConfigurableFunnel.tsx`**
- Linha 51: `Math.max(... * 100, 15)` → `Math.max(... * 100, 8)`
- Linha 65: `minWidth: '200px'` → `minWidth: '120px'`
- Mesma alteração na barra de Ganhos (linhas ~93-94)

**2. `src/components/insights/visuals/VisualQuickSettings.tsx`**
- Linha 92-95: Adicionar `chartType: visual.chart_type` ao `useVisualData`:
```ts
const { data: visualData } = useVisualData({
  config,
  chartType: visual.chart_type || undefined,
  enabled: open && !!config && showCategoryFilter,
});
```

