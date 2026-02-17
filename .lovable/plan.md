

## Corrigir exibicao do grafico de Barras Empilhadas

### Problema

O grafico "Faturamento Diario por Vendedor" mostra "Sem dados para exibir" apesar dos dados serem buscados com sucesso do banco (confirmado via requisicoes de rede).

A causa raiz esta no `ConfigurableChart.tsx`, linha que verifica dados vazios:

```typescript
if (type !== 'gauge' && (!data || data.length === 0)) {
  return <div>Sem dados para exibir</div>;
}
```

Para graficos empilhados (`bar_stacked`), o hook `useVisualData` e desabilitado (pois `isStacked = true`), entao `data` e sempre `[]`. Essa verificacao faz o componente retornar "Sem dados" antes de chegar ao `case 'bar_stacked'` no switch, que usaria `stackedData`.

### Solucao

Excluir `bar_stacked` da verificacao de dados vazios, assim como `gauge` ja e excluido.

### Mudanca

**`src/components/insights/visuals/ConfigurableChart.tsx`** (uma unica linha):

De:
```typescript
if (type !== 'gauge' && (!data || data.length === 0)) {
```

Para:
```typescript
if (type !== 'gauge' && type !== 'bar_stacked' && (!data || data.length === 0)) {
```

### Resultado

O grafico empilhado passara pela verificacao inicial e chegara ao `case 'bar_stacked'` no switch, onde recebera os `stackedData` corretamente. O componente `StackedHorizontalBarChart` ja tem sua propria verificacao de dados vazios interna.

