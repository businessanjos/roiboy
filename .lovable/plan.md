

## Suporte a Tabelas (data_table) no Dashboard Compartilhado

### Problema
O visual `data_table` é ignorado na Edge Function (`visualsData[id] = []`) e o `SharedVisualCard` exibe "Tabelas não são suportadas". Isso impede a visualização de dados tabulares importantes no link compartilhado.

### Causa
O `ConfigurableTable` internamente usa `useVisualDrilldown` que faz queries autenticadas ao banco. No contexto compartilhado (Edge Function), essa abordagem não funciona. A solução é computar os dados tabulares (DrilldownRecord[]) server-side e renderizá-los client-side com uma versão simplificada da tabela.

### Plano

**1. Edge Function (`supabase/functions/shared-dashboard/index.ts`)**

- Criar função `computeDataTableRecords(supabase, accountId, config, filters)` que replica a lógica de `useVisualDrilldown`:
  - Para `deals`: paginar deals com joins (stage name, responsible name), aplicar lead/deal field filters, retornar `DrilldownRecord[]` com extras (stage, responsible, source, won_at, lost_reason)
  - Para `leads`: reutilizar a lógica existente em `computeLeadsData` mas retornar registros brutos em vez de agregados — incluindo email, phone, source, revenue_range. Adicionar enriquecimento de "Origem da Venda" e deal_status (mini-versão de `fetchDealSourceForLeads`)
  - Para `tasks` e `products`: queries simples com mapeamento para DrilldownRecord
- No loop principal de visuais, em vez de `visualsData[id] = []` para data_table, chamar `computeDataTableRecords` e armazenar em um novo campo `drilldownData`
- Retornar `drilldownData` no JSON de resposta junto com `visualsData` e `stackedVisualsData`

**2. Frontend - SharedInsightsDashboard (`src/pages/SharedInsightsDashboard.tsx`)**

- Extrair `drilldownData` da resposta da Edge Function
- Passar `drilldownData[visual.id]` como prop para `SharedVisualCard`

**3. Frontend - SharedVisualCard (`src/components/insights/visuals/SharedVisualCard.tsx`)**

- Adicionar prop opcional `drilldownData?: DrilldownRecord[]`
- Para `data_table`: em vez de mostrar "não suportado", renderizar uma tabela read-only usando as column definitions de `ConfigurableTable` (`getColumnsForDataSource`, `getDefaultColumns`)
- A tabela será uma versão simplificada (sem filtros persistidos, sem resize de colunas) — apenas header + rows com scroll

### Arquivos alterados
- `supabase/functions/shared-dashboard/index.ts` — nova função `computeDataTableRecords` + integração no loop principal + retorno de `drilldownData`
- `src/pages/SharedInsightsDashboard.tsx` — extrair e passar `drilldownData`
- `src/components/insights/visuals/SharedVisualCard.tsx` — renderizar tabela para `data_table`

