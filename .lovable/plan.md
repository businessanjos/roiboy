

## Correção: Ocultar rótulos que não cabem nos segmentos

### Problema
A função `renderInsideLabel` só verifica `width < 50` para barras horizontais. No modo vertical, o espaço relevante é a `height` do segmento, e mesmo para horizontal, 50px pode ser insuficiente para textos longos. Resultado: rótulos espremidos e ilegíveis.

### Solução
Atualizar `renderInsideLabel` em `StackedHorizontalBarChart.tsx` para verificar **ambas** as dimensões — tanto `width` quanto `height` — garantindo que o rótulo só apareça se houver espaço suficiente:

```typescript
const renderInsideLabel = (props: any, formatting: { type: FormatType }, fontMultiplier: number) => {
  const { x, y, width, height, value } = props;
  const minWidth = 40 * fontMultiplier;
  const minHeight = 18 * fontMultiplier;
  if (!value || value === 0 || width < minWidth || height < minHeight) return null;
  // ... render text
};
```

### Arquivo afetado
- `src/components/insights/visuals/StackedHorizontalBarChart.tsx` — linha 67

