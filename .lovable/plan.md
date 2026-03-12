

## Problema
O botão de alternância de tipo de gráfico não aparece porque `InsightsMainContent.tsx` não passa `onUpdateVisual` para o `InsightsGrid`.

Linha 277-280 de `InsightsMainContent.tsx`:
```tsx
<InsightsGrid 
  visuals={visuals} 
  onLayoutChange={handleLayoutChange} 
/>
// Faltam: onUpdateVisual={updateVisual} onRemoveVisual={removeVisual}
```

A condição no `ConfigurableVisualCard` (linha 192) exige `onUpdateVisual` para renderizar o botão:
```tsx
{SWITCHABLE_SET.has(chartType) && onUpdateVisual && (
```

## Correção

**Arquivo: `src/components/insights/InsightsMainContent.tsx`**

1. Extrair `removeVisual` do hook `useInsightsDashboards` (linha 27)
2. Passar `onUpdateVisual={updateVisual}` e `onRemoveVisual={removeVisual}` nas duas instâncias de `<InsightsGrid>`:
   - Linha 214 (modo foco — read-only, mas ainda precisa para o botão funcionar)
   - Linha 277 (painel normal)

Isso fará o botão `ArrowLeftRight` aparecer em todos os visuais do tipo gráfico padrão.

