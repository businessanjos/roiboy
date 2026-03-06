

## Correção: Paridade de dados no dashboard compartilhado

### Problema identificado

A Edge Function `shared-dashboard` reimplementa a lógica de dados de forma simplificada, causando múltiplas discrepâncias com o painel interno:

| Recurso | Painel Interno (`useVisualData`) | Dashboard Compartilhado (Edge Function) |
|---|---|---|
| **inferStatusFilter** (Scorecards de valor usam `won`) | Sim | **Não** — soma TODOS os deals, não apenas ganhos |
| **Filtro de leads convertidos** (`converted_to_client_id IS NULL`) | Sim | **Não** — conta leads já convertidos |
| **Paginação completa** | Loop de 1000 em 1000 | `.limit(5000)` — pode perder dados |
| **Enriquecimento MQL** (deals e leads) | Sim | **Não** |
| **Enriquecimento Faturamento Atual** (leads) | Sim | **Não** |
| **Enriquecimento Canal de Venda** (deals) | Sim | **Não** |
| **Enriquecimento Proprietário** (leads → deal owner) | Sim | **Não** |
| **Cores de etapa** (stage_name → color) | Sim, via `getGroupColor` | **Não** — cores não retornadas |
| **Funil com ordenação + "Ganhos"** | Sim | **Não** |
| **dealStatusFilter** (multi-status) | Sim | **Não** |
| **Lead/Deal field filters** (AND logic) | Sim | **Não** |
| **fillEmptyDates** | Sim | **Não** |
| **formatDateGroup** com `ptBR` locale | Sim (`date-fns`) | Manual (pode divergir) |
| **Data filter field logic** | Prioriza `won_at`/`lost_at` pelo status | Lógica diferente via `getDateFieldForVisual` |

Isso explica as diferenças vistas nos screenshots: o "Faturamento" mostra R$ 389K (todos os deals) em vez de R$ 70,8K (apenas ganhos), e o "Quantidade de Leads" conta 94 (incluindo convertidos) em vez de 44.

### Solução

Reescrever as funções de computação na Edge Function para replicar exatamente a lógica do `useVisualData`:

**Arquivo: `supabase/functions/shared-dashboard/index.ts`**

1. **`inferStatusFilter`** — Adicionar a mesma função: quando `dimension.field === '_total'` e `measure.field === 'value'` com `sum`/`avg`, inferir `statusFilter = 'won'`

2. **`computeDealsData`** — Reescrever para:
   - Usar `inferStatusFilter` quando `statusFilter` não estiver definido
   - Priorizar campo de data pelo status (`won` → `won_at`, `lost` → `lost_at`)
   - Implementar paginação (loop de 1000)
   - Suportar `dealStatusFilter` (multi-value)
   - Enriquecer com MQL, Canal quando dimension usa esses campos
   - Retornar cores de etapa via `getGroupColor`

3. **`computeLeadsData`** — Reescrever para:
   - Filtrar `converted_to_client_id IS NULL`
   - Implementar paginação
   - Enriquecer com MQL, Faturamento, Proprietário quando dimension usa esses campos

4. **`aggregateData`** — Reescrever para:
   - Usar `getGroupKey` e `getGroupColor` equivalentes
   - Filtrar "Sem Responsável"
   - Suportar `_total` scorecard

5. **`computeVisualData`** — Adicionar:
   - Suporte a funnel (ordenação de etapas + "Ganhos")
   - `fillEmptyDates` quando `appearance.fillEmptyDates === true`
   - Conversão de `formatDateGroup` com lógica idêntica ao client

6. **`computeStackedVisualData`** — Adicionar:
   - Paginação
   - Enriquecimento de dados quando `stackByCustomField` usa campos especiais

### Arquivos alterados
- `supabase/functions/shared-dashboard/index.ts` (reescrita significativa das funções de computação)

### Nota
A reescrita mantém a estrutura existente da Edge Function (auth, access control, routing), alterando apenas as funções de computação de dados para garantir paridade total com o hook `useVisualData`.

