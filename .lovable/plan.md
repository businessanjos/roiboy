

## Diagnóstico

O gauge "Faturamento x Meta" mostra R$ 106.2K, mas o gráfico "Faturamento Diário por Vendedor" mostra um total significativamente maior. A causa raiz está na configuração do visual no banco de dados:

```text
Gauge config:
  dimension.field = "created_at"   ← PROBLEMA
  statusFilter   = "won"
```

**O que acontece:** Quando `dimension.field = "created_at"` e `statusFilter = "won"`, o hook `useVisualData` usa `created_at` como campo de filtro de data (linha 571). Isso significa que o gauge busca negócios **criados** em março com status "won", em vez de negócios **ganhos** em março.

O gráfico stacked ("Faturamento Diário por Vendedor") provavelmente usa `dimension.field = "won_at"`, então filtra corretamente por data de ganho.

**Resultado:** Negócios criados antes de março mas ganhos em março aparecem no gráfico mas NÃO no gauge. Negócios criados em março mas não ganhos ainda aparecem no gauge mas não no gráfico.

## Correção

Separar o conceito de **campo de filtro de data** do **campo de agrupamento da dimensão**. Quando existe um `statusFilter` explícito, o filtro de data deve usar o campo correspondente ao status, independentemente do campo da dimensão:

- `statusFilter = 'won'` → filtrar por `won_at`
- `statusFilter = 'lost'` → filtrar por `lost_at`
- Sem statusFilter → filtrar por `created_at`

O campo da dimensão continua controlando como os dados são **agrupados** no eixo X.

### Arquivo: `src/hooks/useVisualData.ts`

Na função `fetchDealsData` (linhas ~569-579), alterar a lógica de determinação do `dateFilterField`:

**Antes:**
```js
if (dimension.type === 'date' && dimension.field && dimension.field !== '_total') {
    dateFilterField = dimension.field;
} else if (statusFilter === 'won') {
    dateFilterField = 'won_at';
} else if (statusFilter === 'lost') {
    dateFilterField = 'lost_at';
} else {
    dateFilterField = 'created_at';
}
```

**Depois:**
```js
// Status filter takes priority for date filtering
// The dimension field only controls grouping, not which records are included
if (statusFilter === 'won') {
    dateFilterField = 'won_at';
} else if (statusFilter === 'lost') {
    dateFilterField = 'lost_at';
} else if (dimension.type === 'date' && dimension.field && dimension.field !== '_total') {
    dateFilterField = dimension.field;
} else {
    dateFilterField = 'created_at';
}
```

Isso garante que quando o `statusFilter` é `won`, **sempre** filtra por `won_at`, independente do campo de dimensão configurado. A dimensão `created_at` continua sendo usada para o agrupamento visual dos dados.

### Impacto

- Corrige o gauge "Faturamento x Meta" para mostrar o valor correto
- Corrige qualquer outro visual de deals com `statusFilter` explícito e dimensão de data diferente
- Não afeta visuais sem statusFilter (comportamento atual mantido)
- Não afeta o gráfico stacked (usa hook separado, que já funciona)

