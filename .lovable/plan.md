

## Correção: Tabela de negócios ganhos retorna apenas 3 de 7

### Causa Raiz

Quando o visual de tabela tem `dealStatusFilter: ['won']`, o filtro de **status** é aplicado corretamente (`status IN ('won')`). Porém, a lógica que escolhe qual campo de data usar para o filtro de período **ignora o `dealStatusFilter`**.

O fluxo atual:
1. `inferStatusFilter()` retorna `undefined` (pois a tabela usa `dimension.field = 'created_at'`, não `'_total'`)
2. `effectiveStatusFilter` = `undefined`
3. O campo de data cai na condição `dimension.type === 'date'` → usa `created_at`
4. A query filtra por `created_at >= 01/03 AND created_at <= 31/03`

**Resultado**: Negócios criados antes de março mas ganhos em março são excluídos. Dos 7 ganhos em março, apenas 3 foram **criados** em março.

### Correção

Em **ambos** os hooks (`useVisualDrilldown.ts` e `useVisualData.ts`) e na **Edge Function** (`shared-dashboard/index.ts`), adicionar verificação de `dealStatusFilter` na lógica de escolha do campo de data:

- Se `dealStatusFilter` contém **apenas** `['won']` → usar `won_at`
- Se `dealStatusFilter` contém **apenas** `['lost']` → usar `lost_at`
- Caso contrário, manter a lógica atual

### Arquivos alterados

1. **`src/hooks/useVisualDrilldown.ts`** (~linhas 84-100) — Antes de checar `dimension.type`, verificar se `dealStatusFilter` indica um campo de data específico
2. **`src/hooks/useVisualData.ts`** (~linhas 577-589) — Mesma lógica: priorizar `dealStatusFilter` na escolha do campo de data
3. **`supabase/functions/shared-dashboard/index.ts`** — Replicar a mesma correção nas funções `computeDealTableRecords` e no fetch principal de deals

### Lógica da correção (pseudocódigo)

```typescript
// Nova lógica para determinar dateFilterField
let dateFilterField: string;
const singleDealStatus = config.dealStatusFilter?.length === 1 ? config.dealStatusFilter[0] : null;

if (effectiveStatusFilter === 'won' || singleDealStatus === 'won') {
  dateFilterField = 'won_at';
} else if (effectiveStatusFilter === 'lost' || singleDealStatus === 'lost') {
  dateFilterField = 'lost_at';
} else if (dimension.type === 'date' && dimension.field && dimension.field !== '_total') {
  dateFilterField = dimension.field;
} else {
  dateFilterField = 'created_at';
}
```

