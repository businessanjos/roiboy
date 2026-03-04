

## Correção: Campos de segmentação não aparecem no dropdown

### Causa raiz

A query em `VisualQuickSettings.tsx` filtra por `.eq('entity', 'deal')` e `.eq('entity', 'lead')`, mas a tabela `custom_fields` **não tem** uma coluna `entity`. O sistema usa flags booleanas: `show_in_deals` e `show_in_leads`.

### Solução

Alterar as duas queries no `useEffect` (linhas 212-227) para usar os filtros corretos:

```typescript
// Deals
supabase
  .from('custom_fields')
  .select('id, name')
  .eq('account_id', currentUser.account_id)
  .eq('show_in_deals', true)
  .eq('is_active', true)
  .order('display_order'),

// Leads
supabase
  .from('custom_fields')
  .select('id, name')
  .eq('account_id', currentUser.account_id)
  .eq('show_in_leads', true)
  .eq('is_active', true)
  .order('display_order'),
```

### Arquivo afetado
- `src/components/insights/visuals/VisualQuickSettings.tsx` — corrigir filtros da query de campos personalizados

