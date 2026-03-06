

## Correção: Paridade completa de dados no dashboard compartilhado

### Problemas identificados

Após análise detalhada da Edge Function `shared-dashboard` vs o hook `useVisualData`, identifiquei **6 problemas críticos** que explicam os visuais que não carregam e os dados incorretos:

| Problema | Impacto |
|---|---|
| **1. Bug no `paginateQuery`** | A função reutiliza o mesmo query builder, acumulando `.order()` e `.range()` a cada iteração. Após a primeira página, as queries subsequentes ficam corrompidas, retornando dados incorretos ou vazios. |
| **2. `sales_cycle` não implementado** | Visuais com `measure.aggregation === 'sales_cycle'` retornam array vazio — nunca carregam. |
| **3. `conversion_rate` não implementado** | Visuais com `measure.aggregation === 'conversion_rate'` retornam array vazio — nunca carregam. |
| **4. `call_commercial` chart type não implementado** | Visuais de tarefas com `chart_type === 'call_commercial'` são tratados como tarefas genéricas — dados incorretos. |
| **5. Task funnel (`TASK_FUNNEL_ORDER`) não implementado** | Visuais de tarefas com `chart_type === 'funnel'` não usam a ordenação fixa de funil — dados incorretos ou ausentes. |
| **6. `productId` filter ignorado** | O filtro de produto da barra de filtros compartilhada nunca é aplicado nos queries de deals/leads. |

### Solução

**Arquivo: `supabase/functions/shared-dashboard/index.ts`**

#### 1. Corrigir `paginateQuery`
Reescrever para NÃO reutilizar o mesmo builder. Em vez disso, aceitar uma factory function que cria uma query limpa a cada iteração:

```typescript
async function paginateQuery(
  buildQuery: () => any,
  orderField: string = 'created_at'
): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await buildQuery()
      .order(orderField, { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) { console.error('Pagination error:', error); return all; }
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
```

Atualizar todas as chamadas a `paginateQuery` para passar uma factory function em vez do builder diretamente.

#### 2. Implementar `sales_cycle`
Adicionar `computeSalesCycleData()` que replica a lógica de `calculateSalesCycle`:
- Busca deals ganhos com `won_at`
- Busca `FIRST_CONTACT_FIELD_ID` de `deal_field_values`
- Calcula diferença em dias entre `won_at` e `first_contact`
- Suporta scorecard (`_total`) e agrupamento por vendedor/data

#### 3. Implementar `conversion_rate`
Adicionar `computeConversionRateData()` que replica `calculateConversionRate` + variantes:
- Scorecard: `(won / total) * 100`
- Por período: agrupa por data
- Por dimensão textual: agrupa por vendedor, etapa, etc.

#### 4. Implementar `call_commercial`
Adicionar `computeCallCommercialData()` que:
- Busca `activity_types` para "Call Comercial Agendada" e "Call Comercial Concluída"
- Conta agendadas (não concluídas) e concluídas por vendedor
- Retorna `{ name, value: scheduled, count: completed }`

#### 5. Implementar task funnel
Adicionar `computeTasksFunnelData()` com `TASK_FUNNEL_ORDER`:
- Busca tarefas concluídas agrupadas por tipo de atividade
- Retorna na ordem fixa do funil

#### 6. Aplicar filtro de produto
Em `computeDealsData`: quando `filters.productId` está definido, buscar `deal_products` para filtrar deals que contêm o produto selecionado.

#### 7. Rotear corretamente em `computeVisualData`
Atualizar o switch para desviar para as novas funções:
```typescript
case 'deals':
  if (config.measure.aggregation === 'sales_cycle')
    result = await computeSalesCycleData(...);
  else if (config.measure.aggregation === 'conversion_rate')
    result = await computeConversionRateData(...);
  else
    result = await computeDealsData(...);
  break;
case 'tasks':
  if (chartType === 'call_commercial')
    result = await computeCallCommercialData(...);
  else if (chartType === 'funnel')
    result = await computeTasksFunnelData(...);
  else
    result = await computeTasksData(...);
  break;
```

### Arquivos alterados
- `supabase/functions/shared-dashboard/index.ts`

