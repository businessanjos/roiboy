

## Agrupar dias 1-31 com soma entre meses na sazonalidade "Diario"

### Problema

Quando o filtro e anual (ex: 2026 inteiro), o agrupamento diario gera 365 pontos no grafico (um para cada dia do ano). O comportamento desejado e: sempre exibir apenas 31 pontos (dias 1 a 31), somando os valores de mesmo dia entre todos os meses do intervalo. Exemplo: dia "13" = soma do dia 13 de janeiro + dia 13 de fevereiro + ... + dia 13 de dezembro.

### Mudancas

**1. `src/hooks/useVisualData.ts`**

- `formatDateGroup`: manter `format(date, 'dd')` (ja esta correto)
- `fillMissingDates`: no case `'day'`, em vez de gerar todos os dias do intervalo, gerar apenas os labels "01" a "31". Antes de retornar, agregar (somar) os valores de pontos com mesmo label
- Na funcao principal de agregacao (onde os dados sao agrupados por `formatDateGroup`), pontos com o mesmo label "dd" serao naturalmente combinados pois a chave e apenas o dia. Porem, como o `groupByDate` faz um `reduce` usando a chave formatada, os dias iguais de meses diferentes ja serao somados. O `fillMissingDates` so precisa garantir que exibe 01-31 fixos

- Ajustar `fillMissingDates` para o case `'day'`: gerar labels fixos "01" a "31", agregar dados duplicados somando `value` e `count`

**2. `src/hooks/useStackedVisualData.ts`**

- `getPeriodKey` no case default (day): mudar de `format(date, 'yyyy-MM-dd')` para `format(date, 'dd')` — assim dias iguais de meses diferentes compartilham a mesma chave e os valores sao somados
- `getPeriodLabel`: manter `format(date, 'dd')` (ja esta correto)
- Geracao de periodos (`allPeriods`): no case default (day), em vez de usar `eachDayOfInterval`, gerar fixamente 31 periodos com keys/labels de "01" a "31"

### Secao tecnica

**Arquivos modificados:**

| Arquivo | Mudanca |
|---------|---------|
| `useVisualData.ts` | `fillMissingDates` day case: gerar labels fixos 01-31 e agregar duplicados |
| `useStackedVisualData.ts` | `getPeriodKey` day: usar `'dd'`; geracao de periodos day: fixo 01-31 |

### Comportamento esperado

- Filtro mensal (ex: Fev/2026): dias 01-28 com dados, dias 29-31 com zero
- Filtro anual (ex: 2026): dias 01-31 com soma de todos os meses
- Filtro customizado (ex: Jan-Mar): dias 01-31 com soma dos 3 meses
- Sempre exibe exatamente 31 pontos no eixo X

