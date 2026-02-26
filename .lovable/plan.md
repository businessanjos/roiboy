

## Corrigir Ordenacao e Valores do Funil de Vendas

### Problemas Identificados

1. **Ordem embaralhada**: A funcao `aggregateData` ordena os resultados por valor decrescente (linha 1018 de useVisualData.ts). Apesar do funil ter logica para reordenar por `display_order` do pipeline (linhas 74-84), o `chartType` nao esta incluido no `queryKey` do React Query (linha 29), fazendo com que dados em cache de antes da correcao sejam servidos sem a ordenacao correta.

2. **Dados incompletos**: A query de deals nao faz paginacao. Se existem mais de 1000 negocios, o Supabase retorna apenas os 1000 primeiros, distorcendo a contagem por etapa.

### Solucao

**Arquivo:** `src/hooks/useVisualData.ts`

Tres alteracoes:

**1. Adicionar `chartType` ao queryKey** para garantir que mudancas no tipo de grafico invalidem o cache:

```text
queryKey: ['visual-data', config, chartType, filters, currentUser?.account_id]
```

**2. Paginar a query de deals em `fetchDealsData`** para garantir que todos os negocios sejam incluidos na contagem, igual ja e feito em `useMapVisualData`:

```text
// Em vez de uma unica query, paginar em blocos de 1000
let allDeals = [];
let from = 0;
const pageSize = 1000;
while (true) {
  const { data, error } = await query.range(from, from + pageSize - 1);
  if (error) return [];
  allDeals = allDeals.concat(data || []);
  if (!data || data.length < pageSize) break;
  from += pageSize;
}
```

**3. Garantir resiliencia na ordenacao do funil** -- caso a query de `deal_stages` falhe, manter a ordem original dos dados em vez de deixar a ordenacao por valor:

```text
// Adicionar log de erro se a query falhar
const { data: stages, error: stagesError } = await supabase...
if (stagesError) console.error('Error fetching stages order:', stagesError);
```

### Resumo de impacto

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useVisualData.ts` | Adicionar chartType ao queryKey, paginar query de deals, melhorar resiliencia do sort |

### Resultado esperado

- A primeira barra do funil sera sempre "Chegou Lead" (primeira etapa do pipeline) com o maior valor cumulativo
- Todas as etapas seguem a ordem exata do pipeline
- Todos os negocios sao contados, sem limite de 1000 registros

