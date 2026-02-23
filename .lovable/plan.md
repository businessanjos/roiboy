

## Adicionar opcao de formatacao nas configuracoes do Indicador

### Problema

O visual "Indicador" exibe valores resumidos (ex: "3K" em vez de "3.000") e nao oferece opcoes de formatacao (Escala de Exibicao e Casas Decimais) nas configuracoes rapidas. Essas opcoes existem apenas para o tipo "Scorecard".

### Causa

No arquivo `VisualQuickSettings.tsx`, a secao de formatacao e renderizada apenas quando `isScorecard` e verdadeiro (linha 314). O tipo `indicator` nao esta incluido nessa condicao.

Alem disso, o componente `ConfigurableIndicator.tsx` usa um `formatValue` padrao que chama `toLocaleString('pt-BR')` sem considerar a escala de exibicao ou casas decimais configuradas.

### Alteracoes

#### 1. `src/components/insights/visuals/VisualQuickSettings.tsx`

- Adicionar deteccao do tipo `indicator`: `const isIndicator = visual.chart_type === 'indicator';`
- Alterar a condicao da secao de formatacao de `{isScorecard && (...)}` para `{(isScorecard || isIndicator) && (...)}`
- Isso exibira os campos "Escala de Exibicao" e "Casas Decimais" tambem para o Indicador

#### 2. `src/components/insights/visuals/ConfigurableChart.tsx`

- No case `'indicator'`, passar uma funcao `formatValue` que utilize `formatValueWithScale` (a mesma funcao usada pelo Scorecard) respeitando `displayScale` e `decimals` da config do visual

#### 3. `src/components/insights/visuals/ConfigurableIndicator.tsx`

- Nenhuma alteracao estrutural necessaria -- o componente ja aceita `formatValue` como prop. Basta garantir que o `ConfigurableChart` passe a funcao correta.

### Resultado

Ao abrir as configuracoes de um visual do tipo Indicador, o usuario vera a secao "Formatacao do Valor" com as opcoes de Escala de Exibicao (Valor Completo, Automatico, Milhares, Milhoes, Bilhoes) e Casas Decimais (0 a 4), identicas ao Scorecard. O valor exibido no arco respeitara essas configuracoes.
