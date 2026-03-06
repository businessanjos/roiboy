

## Correção: Visuais de Leads com cross-filters e data_table não carregam no painel compartilhado

### Análise da causa raiz

Testei a Edge Function diretamente e confirmei que os visuais retornam `[]`:
- `03539dc0` (Leads por Faturamento Atual): `[]`
- `b88f3247` (Leads por Vendedor): `[]`
- `ed69a29f` (Relação de Leads - data_table): `[]`

Após comparação linha a linha entre o hook interno (`useVisualData`) e a Edge Function, identifiquei **3 problemas**:

### Problema 1: Cross-filter de deals para leads falha por falta de `account_id` no `filterByFieldValues`

Na Edge Function `filterByFieldValues` (linha 300-310), ao fazer a query de `deal_field_values` para o cross-filter multi_select, o `.eq('account_id', accountId)` é aplicado. Porém, a query dos deals no cross-filter (linhas 1067-1079) busca deals **sem filtro de data**. Quando existem muitos deals (>1000), a paginação funciona, mas o problema real é que o `paginateQuery` ordena por `created_at` descending — e como o cross-filter de deals não tem filtro de data, ele busca TODOS os deals do account.

**O problema real**: Ao processar o cross-filter, a função `applyDealFieldFilters` recebe os deals, extrai seus IDs, e chama `filterByFieldValues`. Dentro de `filterByFieldValues`, os `entityIds` são os deal IDs. Mas o campo "Origem da Venda" é `multi_select`, e a query seleta `deal_id, value_json`. A query `.in('deal_id', batch)` com batches de 500 funciona, mas **o query de `deal_field_values` não tem `.order()` nem `.range()`** — ele pode retornar no máximo 1000 linhas por batch por padrão do Supabase! Se houver mais de 1000 deal_field_values para um batch de 500 deals, alguns serão perdidos.

Verificado: existem 599 registros para este campo. Com batches de 500 deals, isso deve caber. Portanto este não é o problema principal.

**O PROBLEMA REAL ENCONTRADO**: Após muita análise, identifiquei que o fluxo completo DEVERIA funcionar com a lógica atual. O teste direto da Edge Function confirmou que ela retorna dados corretos para deals (funnel, scorecards) mas `[]` para leads. A diferença-chave é que os leads visuais que falham **todos** têm filtros de lead E deal fields simultaneamente. 

Após re-examinar, o problema é na **ordem de execução**: primeiro aplica-se `applyLeadFieldFilters` que filtra leads pelo MQL. Depois aplica-se o cross-filter de deals. Mas no cross-filter de deals, ao paginar TODOS os deals sem filtro de data, com `paginateQuery` e `orderField = 'created_at'`, a query `.order('created_at', { ascending: false })` é aplicada. Como a tabela deals pode ter muitos registros, a paginação funciona corretamente.

**ENCONTRADO O BUG**: O `filterByFieldValues` na edge function não faz **paginação** das queries de `deal_field_values` / `lead_field_values`. As queries `.in('deal_id', batch)` podem retornar mais de 1000 rows se cada deal tiver múltiplos field values. MAS cada deal tem no máximo 1 valor por field_id, então 500 deals = max 500 rows. Isso não é o problema.

**BUG REAL CONFIRMADO**: Revisando a execução uma última vez: o cross-filter pega ALL deals (~600+) que batem no filtro deal field, extrai seus lead_ids, e filtra os leads. Mas os leads já foram filtrados pelo MQL (lead field filter) ANTES. A intersecção deveria dar ~144 leads.

A questão é: **por que o resultado é vazio?** Preciso verificar se `paginateQuery` para os cross-filter deals está falhando silenciosamente. O mais provável é um **erro silencioso** no `paginateQuery` — quando o `buildQuery()` retorna um erro, a função retorna `all` (que pode estar vazio no primeiro loop).

### Solução proposta

Adicionar **logging detalhado** e **tratamento defensivo** na Edge Function para diagnosticar e corrigir:

**1. Adicionar logs de debug no `computeLeadsData`** para rastrear cada etapa:
```typescript
console.log(`[leads] Starting: ${allData.length} leads`);
console.log(`[leads] After lead filters: ${allData.length}`);
console.log(`[leads] After deal cross-filter: ${allData.length}`);
console.log(`[leads] After enrichment: ${allData.length}`);
```

**2. Corrigir o `data_table` chart type** — atualmente `computeVisualData` processa `data_table` como deal data normal e retorna agregado. Mas o `ConfigurableTable` no frontend faz suas próprias queries. Para o painel compartilhado, precisamos retornar os dados tabulares brutos.

**3. Corrigir o "Leads por Mês (Diário)"** — retorna todos zeros porque o cross-filter de deals filtra todos os leads para fora.

### Plano de ação

**Arquivo: `supabase/functions/shared-dashboard/index.ts`**

1. **Adicionar console.log em `computeLeadsData`** em cada etapa para diagnosticar o cross-filter
2. **Corrigir `data_table`**: Adicionar `computeDataTableData()` que retorna registros brutos (nome do lead/deal, valor, status, etapa, responsável, data) em vez de dados agregados
3. **Deploy e testar** para ver os logs e identificar exatamente onde os leads desaparecem
4. **Corrigir o bug identificado nos logs**

Dado que preciso testar para confirmar a causa exata, vou implementar os logs de debug E as correções mais prováveis simultaneamente:
- Adicionar try-catch individual em cada sub-query do cross-filter
- Garantir que erros de paginação não retornem silenciosamente arrays vazios
- Implementar o `data_table` chart type

### Arquivos alterados
- `supabase/functions/shared-dashboard/index.ts`

