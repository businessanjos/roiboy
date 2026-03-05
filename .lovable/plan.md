

## Plano: Alinhar Taxas de Conversão com Funil de Vendas

### Causa Raiz

O funil visual (custom visual no InsightsGrid) usa `useVisualData`, que conta deals ganhos filtrando por `won_at`. Já as Taxas de Conversão usam `useWhatsAppDashboardData`, que conta deals ganhos a partir de uma query filtrada por `created_at`. Deals criados em um período mas ganhos em outro geram contagens diferentes.

Além disso, o `stage.count` no dashboard inclui deals de TODOS os status (open, won, lost), enquanto o funil visual (`useVisualData`) também conta todos os status. Ambos deveriam ser equivalentes, mas a diferença no filtro de data dos won deals (`created_at` vs `won_at`) gera a divergência de 1-2 deals nos acumulados.

### Solução

Adicionar uma query separada no `useWhatsAppDashboardData` para contar deals ganhos usando `won_at` (igual ao funil visual), e usar esse valor como base do acumulador no painel.

### Alterações

**Arquivo: `src/hooks/useWhatsAppDashboardData.ts`**

Após a query principal de deals (linha ~160), adicionar uma query separada para won deals filtrando por `won_at`:

```typescript
// Fetch won deals count using won_at filter (matches funnel visual logic)
let wonDealsQuery = supabase
  .from('deals')
  .select('id', { count: 'exact', head: true })
  .eq('account_id', accountId)
  .eq('status', 'won')
  .not('won_at', 'is', null)
  .gte('won_at', filters.startDate)
  .lte('won_at', filters.endDate);

if (userFilter) {
  wonDealsQuery = wonDealsQuery.eq('responsible_user_id', userFilter);
}

const { count: wonDealsForFunnel } = await wonDealsQuery;
```

Expor esse valor como `wonDealsForFunnel` no retorno do hook (novo campo no `WhatsAppDashboardData`).

**Arquivo: `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`**

Substituir o cálculo de `totalWonDeals` (linha 113) para usar o novo campo:

```typescript
const totalWonDeals = data?.wonDealsForFunnel ?? 0;
```

Isso garante que o acumulador do painel use exatamente o mesmo valor de "Ganhos" que o funil visual exibe.

### Resultado Esperado
Os percentuais e contagens nas Taxas de Conversão serão idênticos aos do Funil de Vendas.

