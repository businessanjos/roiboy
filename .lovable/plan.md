

## Corrigir eixo Y cortado no grafico de linha (LineChartView)

### Problema

O `LineChartView` tem exatamente o mesmo problema que acabamos de corrigir no `BarChartView`: o `YAxis` tem largura fixa de `60px` e margem esquerda de `0`, insuficientes para valores como "R$880.000". Os rotulos do eixo Y ficam cortados na borda esquerda do container.

### Solucao

**Arquivo:** `src/components/insights/visuals/ConfigurableChart.tsx` - Funcao `LineChartView`

Duas alteracoes identicas as que fizemos no `BarChartView`:

1. **Margem esquerda do LineChart**: de `0` para `10`
2. **Largura do YAxis**: de `60` fixo para `Math.round(80 * m)` (dinamico com a escala de fonte)

O multiplicador `m` ja esta calculado corretamente nessa funcao (linha 239), entao basta aplicar nos dois locais.

