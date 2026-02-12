

## Corrigir contagem de leads nos Insights: filtro de convertidos + paginacao no drilldown

### Problemas identificados

1. **Contagem incorreta (2.802 vs 2.755):** A query de contagem no scorecard NAO filtra leads ja convertidos em clientes (`converted_to_client_id IS NULL`). A aba Leads aplica esse filtro, resultando em 2.755. O Insights conta todos (2.803), gerando discrepancia.

2. **Drilldown limitado a 1.000 registros:** O hook `useVisualDrilldown.ts` (funcao `fetchLeadsRecords`) continua usando uma query simples sem paginacao, limitada aos primeiros 1.000 registros pelo banco.

### Solucao

#### 1. Adicionar filtro `converted_to_client_id IS NULL` em TODAS as queries de leads

**Arquivo:** `src/hooks/useVisualData.ts`

- Na query de contagem server-side (scorecard, linha ~468): adicionar `.is('converted_to_client_id', null)`
- Na query paginada (agrupamentos, linha ~496): adicionar `.is('converted_to_client_id', null)`

**Arquivo:** `src/hooks/useVisualDrilldown.ts`

- Na funcao `fetchLeadsRecords` (linha ~138): adicionar `.is('converted_to_client_id', null)`

#### 2. Paginar o drilldown de leads

**Arquivo:** `src/hooks/useVisualDrilldown.ts`

Substituir a query unica na funcao `fetchLeadsRecords` por um loop de paginacao identico ao implementado em `useVisualData.ts`:

```text
let allData = [];
let from = 0;
const pageSize = 1000;
while (true) {
  const { data } = await query.range(from, from + pageSize - 1);
  allData = allData.concat(data || []);
  if (!data || data.length < pageSize) break;
  from += pageSize;
}
```

### Resultado esperado

- Scorecard mostrara **2.755** (contagem real de leads ativos, excluindo convertidos)
- Drilldown mostrara **todos** os registros, nao apenas os primeiros 1.000
- Dados consistentes entre aba Leads e visuais de Insights

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useVisualData.ts` | Adicionar `.is('converted_to_client_id', null)` nas queries de scorecard e paginada |
| `src/hooks/useVisualDrilldown.ts` | Adicionar filtro de convertidos + implementar paginacao na funcao `fetchLeadsRecords` |

