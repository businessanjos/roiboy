

## Reduzir espaco do eixo Y no grafico de barras empilhadas

### Problema

A largura fixa de `width={120}` no eixo Y e excessiva para os rotulos atuais ("Trafego Pago", "Nao informado"), criando um espaco vazio grande no lado esquerdo do grafico.

### Alteracao

#### `src/components/insights/visuals/StackedHorizontalBarChart.tsx`

Reduzir a largura do eixo Y de `120` para `90`. Esse valor acomoda textos como "Trafego Pago" e "Nao informado" sem corte, mas sem desperdicar espaco.

Tambem ajustar a margem esquerda do `BarChart` de `10` para `0` para reduzir o espaco extra.

