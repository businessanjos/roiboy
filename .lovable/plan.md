

## Problema: Rótulos de dados desapareceram no gráfico empilhado horizontal

### Causa raiz

A função `renderInsideLabel` em `StackedHorizontalBarChart.tsx` (linha 65-69) escala os thresholds mínimos (`minWidth` e `minHeight`) pelo multiplicador de fonte:

```
minWidth = 40 * fontMultiplier   // xlarge: 64px
minHeight = 18 * fontMultiplier  // xlarge: 28.8px
```

Com 31 pontos de dados (dias), cada barra horizontal tem ~32px de altura total. Dividida entre 4 vendedores (séries empilhadas), cada segmento tem ~8px de altura — muito abaixo dos 28.8px exigidos. Resultado: **todos** os rótulos são filtrados e nenhum é exibido.

### Correção

**Arquivo: `src/components/insights/visuals/StackedHorizontalBarChart.tsx`**

1. **Reduzir os thresholds mínimos** — não escalar `minWidth`/`minHeight` pelo multiplicador de fonte (o threshold define espaço disponível, não tamanho do texto):
   - `minWidth`: fixo em 35px
   - `minHeight`: fixo em 14px

2. **Reduzir o fontSize do label** quando o espaço é pequeno — usar `Math.min(fontSize, height - 2)` para que o texto caiba mesmo em segmentos estreitos.

3. **Aumentar `barHeight`** de 32 para 40px no layout horizontal para dar mais espaço vertical a cada barra, melhorando a legibilidade.

Isso restaura os rótulos dentro das barras sem comprometer a legibilidade, independente do `fontScale` configurado.

