
## Corrigir filtro de categorias ocultas para graficos empilhados (bar_stacked)

### Problema

O visual "Leads por Faturamento Atual" e do tipo `bar_stacked`. O filtro `hiddenCategories` so e aplicado ao `processedData`, que filtra dados vindos do `useVisualData`. Porem, para graficos empilhados, o `useVisualData` esta desabilitado -- os dados vem do `useStackedVisualData` e sao passados diretamente ao `ConfigurableChart` sem nenhuma filtragem por `hiddenCategories`.

Resultado: desmarcar "Nao informado" nas configuracoes salva corretamente no banco (confirmado via query), mas o filtro nunca e aplicado aos dados exibidos.

### Solucao

**Arquivo:** `src/components/insights/visuals/ConfigurableVisualCard.tsx`

Adicionar um memo que filtra `stackedResult.data` removendo entradas cujo `name` esteja em `hiddenCategories`, analogo ao que ja e feito para `processedData`. Os `seriesKeys` permanecem inalterados (series internas nao sao afetadas).

```typescript
const processedStackedData = useMemo(() => {
  if (!stackedResult?.data) return undefined;
  if (!config?.hiddenCategories?.length) return stackedResult;
  return {
    data: stackedResult.data.filter(
      (item) => !config.hiddenCategories!.includes(item.name)
    ),
    seriesKeys: stackedResult.seriesKeys,
  };
}, [stackedResult, config?.hiddenCategories]);
```

E atualizar as referencias de `stackedResult` para `processedStackedData` nas props do `ConfigurableChart` (linhas 208-209).

### Impacto

Corrige o filtro de categorias ocultas para TODOS os visuais do tipo `bar_stacked`, nao apenas este. Nenhum outro arquivo precisa ser alterado.

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/insights/visuals/ConfigurableVisualCard.tsx` | Adicionar memo para filtrar stackedData por hiddenCategories e usar o resultado filtrado na renderizacao |
