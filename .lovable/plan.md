

## Corrigir contagem de leads nos visuais de Insights

### Problema

A funcao `fetchLeadsData` em `src/hooks/useVisualData.ts` busca todos os registros da tabela `leads` usando `.select('id, status, source, ...')`, que esta limitado a 1000 linhas pelo padrao do banco. Para um scorecard de contagem total, o resultado mostra "1.000" quando na realidade existem 2.755+ leads.

### Solucao

Para o caso de scorecard (quando `dimension.field === '_total'` e a agregacao e `count`), substituir a query que busca todos os registros por uma query de contagem server-side usando `{ count: 'exact', head: true }`. Isso retorna apenas o numero total sem transferir nenhuma linha, eliminando o limite de 1000.

Para os demais casos (agrupamentos por status, origem, etc.), sera necessario paginar os resultados para garantir que todos os registros sejam processados.

### Detalhes tecnicos

**Arquivo:** `src/hooks/useVisualData.ts`

Modificar a funcao `fetchLeadsData` (linha ~459):

1. **Scorecard (_total):** Detectar quando e um scorecard de contagem e usar query otimizada:
   ```text
   // Antes: busca ate 1000 linhas e conta no JS
   .select('id, status, source, revenue_range, created_at')
   
   // Depois: conta no servidor sem limite
   .select('*', { count: 'exact', head: true })
   ```

2. **Agrupamentos (status, source, etc.):** Implementar paginacao para buscar TODOS os registros em lotes de 1000:
   ```text
   // Buscar em lotes ate esgotar os resultados
   let allData = [];
   let from = 0;
   const pageSize = 1000;
   while (true) {
     const { data } = await query.range(from, from + pageSize - 1);
     allData.push(...data);
     if (data.length < pageSize) break;
     from += pageSize;
   }
   ```

### Resultado esperado

- O scorecard de "Total de Leads" exibira o numero correto (2.755 em vez de 1.000)
- Agrupamentos por dimensao tambem refletirao a totalidade dos dados
- Performance otimizada: scorecards usam contagem server-side sem transferir dados

