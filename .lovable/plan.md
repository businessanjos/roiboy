

## Exibir Legenda mesmo com uma única série no gráfico empilhado

### Problema
No `StackedHorizontalBarChart`, a legenda só é renderizada quando `seriesKeys.length > 1`. Se o filtro resulta em apenas um produto, a legenda desaparece e o usuário não sabe a que item a barra se refere.

### Correção

**Arquivo: `src/components/insights/visuals/StackedHorizontalBarChart.tsx`**

Alterar a condição de exibição da Legend de `seriesKeys.length > 1` para `seriesKeys.length >= 1` em ambos os locais (orientação vertical e horizontal), nas linhas ~128 e ~184.

Mudança mínima — duas linhas:
- Linha 128: `{seriesKeys.length > 1 &&` → `{seriesKeys.length >= 1 &&`
- Linha 184: `{seriesKeys.length > 1 &&` → `{seriesKeys.length >= 1 &&`

