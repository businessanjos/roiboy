

## Diagnóstico: Visual de tabela crashando na página Marketing Insights

### Causa Raiz
O erro no console é claro: **"useInsightsDashboards must be used within InsightsDashboardsProvider"**.

O componente `ConfigurableVisualCard` renderiza `VisualQuickSettings`, que internamente chama `useInsightsDashboards()` (versão estrita que lança exceção). A página Marketing Insights **não** está envolvida por `InsightsDashboardsProvider`, então o componente crasheia e o `VisualErrorBoundary` captura o erro exibindo "Erro ao renderizar este visual".

### Solução
Modificar `VisualQuickSettings` para usar `useInsightsDashboardsSafe()` em vez de `useInsightsDashboards()`, e aceitar props opcionais de override (`updateVisual`, `removeVisual`) — padrão similar ao que já foi feito no `AddVisualModal`.

Alternativamente (e de forma mais simples): fazer o `ConfigurableVisualCard` aceitar funções `updateVisual` e `removeVisual` como props opcionais e repassá-las ao `VisualQuickSettings`.

**Abordagem escolhida** (mínima e consistente): Alterar `VisualQuickSettings` para usar `useInsightsDashboardsSafe()` e receber overrides via props.

### Arquivos Afetados

1. **`src/components/insights/visuals/VisualQuickSettings.tsx`**
   - Trocar `useInsightsDashboards()` por `useInsightsDashboardsSafe()`
   - Adicionar props `overrideUpdateVisual` e `overrideRemoveVisual`
   - Usar `override ?? ctx?.updateVisual` com fallback

2. **`src/components/insights/visuals/ConfigurableVisualCard.tsx`**
   - Aceitar props opcionais `onUpdateVisual` e `onRemoveVisual`
   - Repassar ao `VisualQuickSettings`

3. **`src/components/insights/grid/InsightsGrid.tsx`**
   - Aceitar props opcionais `onUpdateVisual` e `onRemoveVisual`
   - Repassar ao `ConfigurableVisualCard`

4. **`src/components/marketing/MarketingInsightsTab.tsx`**
   - Passar `updateVisual` e `removeVisual` do hook `useMarketingDashboards` para o `InsightsGrid`

