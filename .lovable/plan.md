

## Intercalar rotulos de dados no grafico de linha

### Ideia

Em vez de ocultar todos os rotulos quando ha muitos pontos, vamos **intercalar** a exibicao: mostrar no 1o ponto, ocultar no 2o, mostrar no 3o, e assim por diante. Isso mantem a informacao visual sem sobreposicao.

### Solucao

**Arquivo:** `src/components/insights/visuals/ConfigurableChart.tsx` - Funcao `LineChartView`

Substituir a condicao `data.length <= 15` por um `formatter` customizado no `LabelList` que retorna o valor formatado apenas para indices pares (0, 2, 4...) e retorna string vazia para indices impares (1, 3, 5...).

Como o `LabelList` do Recharts nao passa o indice diretamente ao `formatter`, a abordagem sera usar um `content` customizado (render prop) no `LabelList` que recebe o `index` e decide se renderiza ou nao.

### Detalhe tecnico

```tsx
<LabelList
  dataKey="value"
  position="top"
  content={({ x, y, value, index }) => {
    if (typeof index !== 'number' || index % 2 !== 0) return null;
    return (
      <text x={x} y={(y as number) - 8} textAnchor="middle"
        style={{ fontSize: Math.round(10 * m), fill: 'hsl(var(--foreground))' }}>
        {formatValueCompact(value as number, formatting.type)}
      </text>
    );
  }}
/>
```

Isso tambem sera aplicado ao `BarChartView` para manter consistencia, intercalando os rotulos quando `data.length > 10`.

