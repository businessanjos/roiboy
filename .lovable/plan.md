
## Filtrar drilldown de "Negocios Ganhos" para exibir apenas deals com status "won"

### Problema

O hook `useVisualDrilldown.ts` na funcao `fetchDealsRecords` nao aplica o `statusFilter` definido na configuracao do visual. Para o scorecard "Negocios Ganhos", que tem `statusFilter: 'won'`, o drilldown mostra todos os 664 registros (open, lost, won) em vez de exibir somente os negocios com status "won".

### Solucao

Adicionar uma verificacao de `config.statusFilter` na funcao `fetchDealsRecords` do arquivo `src/hooks/useVisualDrilldown.ts`. Se o valor existir (ex: `'won'` ou `'lost'`), aplicar `.eq('status', statusFilter)` na query do Supabase.

### Mudanca

**`src/hooks/useVisualDrilldown.ts`** - funcao `fetchDealsRecords` (linha ~75, apos `.eq('account_id', accountId)`):

Adicionar:
```typescript
// Apply status filter from visual config (e.g., 'won' for won deals scorecard)
if (config.statusFilter) {
  query = query.eq('status', config.statusFilter);
}
```

### Arquivo modificado

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useVisualDrilldown.ts` | Aplicar `statusFilter` do config na query de deals |
