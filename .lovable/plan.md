
# Alterar Filtro de Período Padrão para "Este Ano"

## Mudança

Alterar o período padrão do painel de Insights de "Este Mês" para "Este Ano".

## Arquivo a Modificar

**`src/hooks/useInsightsFilters.tsx`** - Linhas 43-53

Alterar a função `getDefaultFilters`:

```typescript
// DE:
const getDefaultFilters = (): InsightsFilters => {
  const now = new Date();
  return {
    startDate: startOfMonth(now).toISOString(),
    endDate: endOfMonth(now).toISOString(),
    userId: "all",
    stageId: "all",
    productId: "all",
    preset: "month",
  };
};

// PARA:
const getDefaultFilters = (): InsightsFilters => {
  const now = new Date();
  return {
    startDate: startOfYear(now).toISOString(),
    endDate: endOfYear(now).toISOString(),
    userId: "all",
    stageId: "all",
    productId: "all",
    preset: "year",
  };
};
```

## Resultado

Ao abrir o painel de Insights, o filtro mostrará "Este Ano" com o intervalo de 01/01/2026 até 31/12/2026.
