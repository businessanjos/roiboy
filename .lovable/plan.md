

## Plano: Tag "Sem Negócio" para leads sem deal vinculado

### Alteração única em `src/components/insights/visuals/ConfigurableTable.tsx`

No componente `DealStatusBadge`, quando `status` for `undefined`/vazio, renderizar uma badge cinza "Sem Negócio" em vez de retornar `null`.

```typescript
// Adicionar ao map:
// sem status → badge cinza "Sem Negócio"
```

- Cor: cinza (`bg-gray-500/15 text-gray-600 border-gray-500/30`)
- Label: "Sem Negócio"

### Arquivo afetado
- `src/components/insights/visuals/ConfigurableTable.tsx` — apenas o componente `DealStatusBadge`

