

## Corrigir rotulos no grafico de linha

### Problemas identificados

1. **Rotulos "R$0" exibidos**: Pontos com valor zero mostram "R$0" desnecessariamente, poluindo o grafico.
2. **Ultimo valor cortado**: O rotulo do ultimo ponto (ex: "R$297.600") e cortado pela borda direita do container porque a margem direita e de apenas `10px` e o `textAnchor` e `"middle"`, fazendo metade do texto ultrapassar o limite.

### Solucao

**Arquivo:** `src/components/insights/visuals/ConfigurableChart.tsx` - Funcao `LineChartView`

#### 1. Ocultar rotulos com valor zero
Na funcao `content` do `LabelList`, adicionar uma condicao para retornar `null` quando o valor for `0` (ou falsy):

```tsx
if (typeof index !== 'number' || index % 2 !== 0) return null;
if (!value || value === 0) return null; // Nao exibir zeros
```

#### 2. Aumentar margem direita para evitar corte
Aumentar a margem direita do `LineChart` de `10` para `40`, dando espaco suficiente para o rotulo do ultimo ponto:

```tsx
<LineChart data={data} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
```

Essas duas mudancas sao simples e localizadas na mesma funcao.

