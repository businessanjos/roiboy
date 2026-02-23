

## Exibir valores inteiros reais em vez de arredondados nos visuais

### Problema

A funcao `formatValueCompact` abrevia valores grandes usando sufixos como "K" e "M" (ex: 3000 vira "3K"). Os visuais usam essa funcao tanto nos rotulos de dados dentro das barras quanto nos eixos e tooltips. O usuario quer ver o valor real inteiro (ex: "3.000" em vez de "3K").

### Alteracao

#### `src/lib/formula-evaluator.ts`

Modificar a funcao `formatValueCompact` para retornar o valor inteiro formatado com separadores de milhar (padrao pt-BR) em vez de abreviar com K/M:

- Remover a logica de abreviacao (`>= 1_000` retorna "K", `>= 1_000_000` retorna "M")
- Usar `Intl.NumberFormat('pt-BR')` para formatar com pontos separadores de milhar
- Manter o prefixo "R$" para currency e o sufixo "%" para percentage
- Resultado: 3000 exibira "3.000" em vez de "3K"

Isso afetara todos os visuais que usam `formatValueCompact`:
- Barras empilhadas (StackedHorizontalBarChart) -- rotulos, eixo X, tooltip
- Barras simples e horizontais (ConfigurableChart) -- rotulos, eixos
- Graficos de linha (ConfigurableChart) -- rotulos, eixos

### Secao tecnica

```text
Antes:  formatValueCompact(3000, 'decimal') -> "3K"
Depois: formatValueCompact(3000, 'decimal') -> "3.000"

Antes:  formatValueCompact(1500000, 'currency') -> "R$1.5M"
Depois: formatValueCompact(1500000, 'currency') -> "R$1.500.000"
```

Nota: para eixos de graficos com valores muito grandes, os numeros completos podem ocupar mais espaco. Isso e um tradeoff aceitavel pela precisao dos dados.

