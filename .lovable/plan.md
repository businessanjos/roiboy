

## Exibir TODOS os dias do mes no grafico de Barras Empilhadas

### Problemas identificados

1. **Dias sem faturamento sao omitidos**: O codigo atual (linha 120-138 de `useStackedVisualData.ts`) so cria pontos para dias que possuem deals. Dias sem vendas simplesmente nao aparecem no grafico.

2. **Deals de meses diferentes se misturam**: O agrupamento usa apenas o numero do dia (`date.getDate()`), sem considerar o mes. Se o filtro de datas abrange janeiro e fevereiro, um deal do dia 15/01 e outro do dia 15/02 sao somados no mesmo "dia 15". Isso causa dados incorretos.

### Solucao

Modificar a funcao `fetchStackedDealsData` em `src/hooks/useStackedVisualData.ts` para:

1. **Determinar o intervalo de datas** a partir dos filtros (`filters.startDate` e `filters.endDate`)
2. **Gerar todos os dias do intervalo** usando `eachDayOfInterval` do date-fns
3. **Agrupar por data completa** (YYYY-MM-DD) em vez de apenas pelo numero do dia
4. **Exibir o label como dia do mes** (ex: "1", "2", ..., "28") mas manter a unicidade por data completa
5. **Incluir dias zerados** no resultado final, com valor 0 para todos os vendedores

### Mudanca tecnica

**`src/hooks/useStackedVisualData.ts`**

- Importar `eachDayOfInterval`, `startOfDay`, `endOfDay` do date-fns
- Usar `filters.startDate` e `filters.endDate` para gerar a lista completa de dias
- Trocar o agrupamento de `dayNum = date.getDate()` para `dayKey = format(date, 'yyyy-MM-dd')`
- Usar o label `format(date, 'd')` (numero do dia) para exibicao, mas prefixar com mes se o intervalo abranger mais de um mes (ex: "15/Jan", "15/Fev")
- Gerar um `StackedDataPoint` para cada dia do intervalo, mesmo que tenha valor 0
- Remover o filtro `if (hasValue)` que descarta dias sem faturamento

### Resultado

O grafico exibira todos os dias do periodo filtrado (ex: 1 a 28 de fevereiro), com barras zeradas nos dias sem vendas, e sem misturar dados de meses diferentes.

### Arquivo modificado

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useStackedVisualData.ts` | Gerar todos os dias do intervalo, agrupar por data completa, incluir dias zerados |

