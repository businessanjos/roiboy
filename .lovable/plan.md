

## Corrigir Tamanho da Fonte no gráfico de Barras Verticais

### Problema

O `BarChartView` (barras verticais, usado pelo visual "Faturamento por Canal") possui tamanhos de fonte **hardcoded** (`fontSize: 10` e `fontSize: 11`), ignorando completamente a configuração `fontScale` do `appearance`. Os outros tipos de gráfico (barras horizontais, linha, pizza) já aplicam corretamente o multiplicador via `FONT_SCALE_MULTIPLIERS`.

### Solução

**Arquivo:** `src/components/insights/visuals/ConfigurableChart.tsx`

Adicionar o cálculo do multiplicador `m` no `BarChartView` (assim como já existe no `HorizontalBarChartView`) e aplicá-lo em todos os tamanhos de fonte:

- **XAxis** tick fontSize: `10` → `Math.round(10 * m)`
- **YAxis** tick fontSize: `11` → `Math.round(11 * m)`
- **LabelList** (rótulos de dados) fontSize: `10` → `Math.round(10 * m)`

Isso consiste em:
1. Adicionar `const m = FONT_SCALE_MULTIPLIERS[appearance.fontScale || 'normal'];` no início da função
2. Substituir os 3 valores hardcoded pelos cálculos dinâmicos

### Resultado

Ao alterar o "Tamanho da Fonte" nas configurações do visual, os textos dos eixos e rótulos do gráfico de barras verticais passarão a escalar corretamente entre Pequena, Normal, Grande e Extra Grande.

