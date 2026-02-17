
## Exibir "Item da Venda" nos cards do Pipeline

### Resumo

Adicionar uma tag com o valor de "Item da Venda" ao lado da tag de "Faturamento Atual" nos cards de negocios do pipeline.

### Abordagem

Seguir o mesmo padrao ja usado para "Faturamento Atual": buscar os valores em lote no `DealKanban`, passar o mapa para `DealKanbanColumn` e de la para o `DealCard`.

### Mudancas

**1. `src/components/sales/DealKanban.tsx`**

- Adicionar constante `ITEM_VENDA_FIELD_ID = '033b91fb-3add-4c96-aec9-567fefbd0fb2'`
- No `useEffect` existente que busca faturamento, adicionar busca paralela para "Item da Venda" (mesmo padrao: `deal_field_values` + `custom_fields` para mapear option value para label)
- Criar estado `itemVendaMap: Record<string, string>`
- Passar `itemVendaMap` para `DealKanbanColumn`
- Passar na `DragOverlay` tambem

**2. `src/components/sales/DealKanbanColumn.tsx`**

- Adicionar prop `itemVendaMap?: Record<string, string>`
- Passar `itemVendaLabel={itemVendaMap?.[deal.id]}` para `DealCard`

**3. `src/components/sales/DealCard.tsx`**

- Adicionar prop `itemVendaLabel?: string`
- Na secao de tags (linha ~310), ao lado do badge de faturamento, renderizar um badge para "Item da Venda" com estilo distinto (ex: azul sutil) quando o valor existir

### Visual do badge

O badge de "Item da Venda" tera estilo similar ao de faturamento mas com cor diferente para diferenciar:
- Faturamento: verde (emerald) - ja existente
- Item da Venda: azul (blue) - novo

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `DealKanban.tsx` | Batch fetch do campo "Item da Venda", novo estado e prop |
| `DealKanbanColumn.tsx` | Receber e repassar `itemVendaMap` |
| `DealCard.tsx` | Nova prop `itemVendaLabel`, renderizar badge azul |
