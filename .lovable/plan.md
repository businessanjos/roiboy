

## Corrigir visuais com valores nulos apos mudanca de filtro

### Causa raiz

O bug esta na funcao `getDateFieldForVisual` no edge function `shared-dashboard/index.ts` (linha 51):

```
if (dimension?.field && dimension.field !== 'created_at') return dimension.field;
```

Scorecards usam `dimension.field = '_total'`. Como `'_total'` nao e `'created_at'`, a funcao retorna `'_total'` como campo de data. Em seguida, `applyDateFilter` aplica `.gte('_total', startDate)` -- filtrando por uma coluna que nao existe na tabela `deals`. Isso faz a query retornar zero resultados para todos os scorecards (Faturamento, Meta, Ticket Medio, Negocios Ganhos, Negocios) e qualquer outro visual com `dimension.field` nao-temporal (ex: `source`, `stage_name`, `responsible_name`).

O visual "Faturamento por Canal" tambem e afetado pela mesma razao: seu `dimension.field` provavelmente e `source` (texto), que tambem e retornado incorretamente como campo de data.

Sem filtros, o problema nao aparece porque `startDate` e `endDate` sao `undefined`, entao `applyDateFilter` nao adiciona nenhuma clausula.

### Solucao

**Arquivo: `supabase/functions/shared-dashboard/index.ts`**

Corrigir a funcao `getDateFieldForVisual` para ignorar campos que nao sao datas reais. Adicionar uma verificacao para excluir `_total` e campos de texto conhecidos:

```typescript
function getDateFieldForVisual(config: any): string {
  const { dimension, statusFilter } = config || {};
  const dateFields = ['created_at', 'won_at', 'lost_at'];
  if (dimension?.field && dateFields.includes(dimension.field)) return dimension.field;
  if (statusFilter === 'won') return 'won_at';
  if (statusFilter === 'lost') return 'lost_at';
  return 'created_at';
}
```

Ou, de forma equivalente, verificar se `dimension.type === 'date'`:

```typescript
function getDateFieldForVisual(config: any): string {
  const { dimension, statusFilter } = config || {};
  if (dimension?.type === 'date' && dimension.field && dimension.field !== 'created_at') {
    return dimension.field;
  }
  if (statusFilter === 'won') return 'won_at';
  if (statusFilter === 'lost') return 'lost_at';
  return 'created_at';
}
```

A segunda abordagem e mais robusta pois verifica o tipo da dimensao em vez de manter uma lista fixa de campos validos.

### Impacto

Essa unica mudanca (1 linha) corrige todos os visuais afetados:
- Scorecards (`dimension.field = '_total'`): filtro de data aplicado em `won_at` ou `created_at` conforme o `statusFilter`
- Graficos por canal/etapa/responsavel (`dimension.field = 'source'`, `stage_name`, etc.): filtro de data aplicado no campo temporal correto
- Visuais com dimensao temporal (`dimension.type = 'date'`): comportamento inalterado, continua usando o campo de data configurado

Nao e necessaria nenhuma alteracao no frontend.
