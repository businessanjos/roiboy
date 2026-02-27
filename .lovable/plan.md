

## Corrigir erro na exportação do Pipeline

### Problema

A query de exportação em `PipelineExportDialog.tsx` (linha 210) solicita a coluna `product_id` na tabela `deals`, mas essa coluna nao existe no schema. O `product_id` e um campo virtual armazenado na tabela `deal_field_values`, nao diretamente em `deals`. Isso causa erro na query do Supabase e impede a exportacao.

### Solucao

Remover `product_id` da query principal de deals e, em vez disso, resolver o "Item da Venda" exclusivamente a partir dos `deal_field_values` ja buscados na etapa 2.

### Alteracao

**Arquivo:** `src/components/sales/PipelineExportDialog.tsx`

1. **Linha 210**: Remover `product_id` do select da query de deals:
   - De: `id, title, value, status, probability, tags, created_at, won_at, lost_at, lost_reason, stage_id, responsible_user_id, lead_id, product_id, leads(...)`
   - Para: `id, title, value, status, probability, tags, created_at, won_at, lost_at, lost_reason, stage_id, responsible_user_id, lead_id, leads(...)`

2. **Linha 263** (filtro por produto): Ajustar o filtro `filterProduct` para buscar o product_id nos `deal_field_values` em vez de `deal.product_id`. Usar o campo customizado "Item da Venda" (ID `033b91fb-3add-4c96-aec9-567fefbd0fb2`) para filtrar.

3. **Linha 367** (resolucao do nome do produto no custom field): Remover referencia a `deal.product_id` que nao existe mais. Resolver o valor do campo "Item da Venda" diretamente do `deal_field_values`.

### Detalhe tecnico

| Local | De | Para |
|---|---|---|
| Select query (L210) | inclui `product_id` | remove `product_id` |
| Filtro de produto (L261-263) | `d.product_id === filterProduct` | busca no `deal_field_values` pelo field_id do item da venda |
| Custom field "Item" (L367) | fallback para `deal.product_id` | busca valor do field_value correspondente |

