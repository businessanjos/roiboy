

## Corrigir rotulos de dados tortos no grafico de barras

### Problema

No grafico de barras "Faturamento por Canal", os rotulos de dados (R$3.628.400, R$2.010.203, etc.) estao desalinhados em relacao as barras. Isso acontece porque o `x` fornecido pelo Recharts no `content` do `LabelList` corresponde a borda esquerda da barra, mas o `textAnchor` esta como `"middle"`, fazendo o texto ficar deslocado para a esquerda.

### Solucao

**Arquivo:** `src/components/insights/visuals/ConfigurableChart.tsx` - Funcao `BarChartView`

Ajustar o calculo da posicao `x` no `content` do `LabelList` para centralizar o rotulo sobre a barra. O Recharts fornece `x` (borda esquerda) e `width` (largura da barra), entao o centro correto e `x + width / 2`:

```tsx
content={({ x, y, value, index, width: barWidth }) => {
  if (data.length > 10 && (typeof index !== 'number' || index % 2 !== 0)) return null;
  const centerX = (x as number) + (barWidth as number) / 2;
  return (
    <text x={centerX} y={(y as number) - 12} textAnchor="middle"
      style={{ fontSize: Math.round(10 * m), fill: 'hsl(var(--foreground))' }}>
      {formatValueCompact(value as number, formatting.type)}
    </text>
  );
}}
```

Isso centraliza cada rotulo perfeitamente acima da sua barra correspondente.

