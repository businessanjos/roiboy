

## Exibir título real do negócio na tabela

### Problema
O fetch de deals no `useVisualDrilldown.ts` não inclui o campo `title` na query do Supabase, e o mapeamento usa `Negócio #${id.slice(0,8)}` como fallback fixo.

### Alteração — `src/hooks/useVisualDrilldown.ts`

1. **Adicionar `title` ao select** da query de deals (linha 64):
   ```sql
   id, title, lead_id, value, ...
   ```

2. **Usar o título real no mapeamento** (linha 160):
   ```typescript
   name: deal.title || `Negócio #${deal.id.slice(0, 8)}`,
   ```

Apenas essas duas linhas precisam mudar. O campo `title` existe na tabela `deals` e será usado quando disponível, mantendo o fallback para deals sem título.

