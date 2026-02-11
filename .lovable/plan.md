

## Diagnostico: Erro "Could not find the 'product_id' column of 'deals'"

### Causa raiz

O campo "Item da Venda" envia um `product_id` no objeto de dados ao salvar o negocio. Na funcao de **criacao** (`createDeal`), esse campo e corretamente extraido antes de inserir na tabela `deals` (pois `product_id` nao e uma coluna dessa tabela — ele e salvo na tabela `deal_field_values`). Porem, na funcao de **atualizacao** (`updateDeal`), o `product_id` **nao e removido** do objeto de dados, e e enviado diretamente para a tabela `deals`, causando o erro de schema.

### Correcao

**Arquivo: `src/hooks/useDeals.tsx`**

Na funcao `updateDeal` (por volta da linha 315), apos montar o `updateData`:

1. Extrair `product_id` do `updateData` antes de enviar para o banco (mesma logica usada no `createDeal`)
2. Apos a atualizacao bem-sucedida do deal, fazer upsert do valor na tabela `deal_field_values` usando o field ID do "Item da Venda" (`033b91fb-3add-4c96-aec9-567fefbd0fb2`)
3. Se `product_id` for `null` ou string vazia (usuario selecionou "Nenhum"), remover o registro correspondente de `deal_field_values`

### Detalhe tecnico

```text
Fluxo atual (com bug):
  updateData = { title, value, product_id, ... }
  -> supabase.from('deals').update(updateData) -> ERRO: coluna nao existe

Fluxo corrigido:
  updateData = { title, value, ... }  (sem product_id)
  productId = data.product_id
  -> supabase.from('deals').update(updateData) -> OK
  -> supabase.from('deal_field_values').upsert({ field_id, value_text: productId }) -> OK
```

A alteracao e minima e segue exatamente o mesmo padrao ja implementado na funcao `createDeal` do mesmo arquivo.

