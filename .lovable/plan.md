

## Corrigir sobreposicao de rotulos no grafico de linha

### Problema

O grafico de linha "Faturamento por Mes (Diario)" apresenta dois problemas de sobreposicao quando ha muitos pontos de dados (ex: 31 dias):

1. **Eixo X**: A propriedade `interval={0}` forca a exibicao de todos os rotulos (01, 02, ... 31), causando sobreposicao quando o espaco horizontal e insuficiente.
2. **Rotulos de dados (LabelList)**: Todos os valores (R$880.000, R$526.000, etc.) sao exibidos na mesma posicao "top", resultando em sobreposicao severa quando pontos estao proximos.

### Solucao

**Arquivo:** `src/components/insights/visuals/ConfigurableChart.tsx` - Funcao `LineChartView`

#### 1. Eixo X - Intervalo automatico
- Alterar `interval={0}` para `interval="preserveStartEnd"`, permitindo que o Recharts oculte automaticamente rotulos intermediarios quando nao ha espaco, mantendo sempre o primeiro e ultimo visiveis.

#### 2. Rotulos de dados - Desativar quando ha muitos pontos
- Quando o dataset possui mais de ~15 pontos, os rotulos de dados (LabelList) se tornam ilegíveis por sobreposicao. A solucao e exibir os rotulos apenas quando `data.length <= 15`, caso contrario os valores continuam acessiveis via tooltip ao passar o mouse.
- Isso mantem o visual limpo sem perder informacao, ja que o tooltip sempre funciona.

### Resultado

- Eixo X limpo e legivel com intervalos automaticos
- Rotulos de dados visiveis apenas quando ha espaco suficiente (ate ~15 pontos)
- Para datasets grandes (diario com 31 pontos), o usuario acessa valores individuais via tooltip

