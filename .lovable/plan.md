

## Corrigir eixo Y cortado no grafico de barras verticais

### Problema

O eixo Y do `BarChartView` tem largura fixa de `60px` e margem esquerda de `0`, insuficientes para exibir valores formatados como "R$3.628.400". Com fontes maiores, o problema piora ainda mais, pois os textos "atravessam" o limite esquerdo do card e ficam ocultos.

### Solucao

**Arquivo:** `src/components/insights/visuals/ConfigurableChart.tsx` - Funcao `BarChartView`

1. **Aumentar largura do YAxis** de `60` para um valor dinamico baseado no multiplicador de fonte: `Math.round(80 * m)` -- isso garante espaco suficiente para valores em reais com separadores de milhar e acompanha o tamanho da fonte selecionado.

2. **Ajustar margem esquerda do BarChart** de `0` para `10`, evitando que o texto do eixo Y fique colado na borda do container.

Essas duas alteracoes garantem que os rotulos do eixo Y fiquem sempre visiveis independentemente do tamanho da fonte ou da magnitude dos valores.

