
## Problema

Os rótulos de dados estão vazando para fora de barras estreitas porque o `minWidth` fixo de 35px não considera o comprimento real do texto formatado. Um valor como "R$70.800" ocupa ~70px mas é renderizado em segmentos de ~40px, causando overflow e sobreposição.

## Correção

**Arquivo: `src/components/insights/visuals/StackedHorizontalBarChart.tsx`**

Na função `renderInsideLabel`, estimar a largura do texto formatado e só renderizar se couber na barra:

```typescript
const renderInsideLabel = (props: any, formatting: { type: FormatType }, fontMultiplier: number) => {
  const { x, y, width, height, value } = props;
  if (!value || value === 0 || height < 14) return null;

  const baseFontSize = Math.round(10 * fontMultiplier);
  const effectiveFontSize = Math.min(baseFontSize, height - 2);

  // Estimar largura do texto: ~0.65 * fontSize por caractere
  const formatted = formatValueCompact(value, formatting.type);
  const estimatedTextWidth = formatted.length * effectiveFontSize * 0.65;

  // Só exibir se o texto couber dentro da barra com margem
  if (estimatedTextWidth + 8 > width) return null;

  return ( ... );
};
```

Isso substitui o `minWidth` fixo por uma verificação dinâmica baseada no comprimento real do texto formatado, garantindo que rótulos nunca ultrapassem os limites da barra.
