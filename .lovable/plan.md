

## Adicionar dimensão "Produto" para visuais de Negócios

### Problema
Não existe a opção de agrupar negócios por Produto no visual builder configurável. O campo "Item da Venda" é armazenado na tabela `deal_field_values` (campo `033b91fb-...`), e o valor pode ser um UUID de produto ou uma chave de opção legada — não está diretamente na tabela `deals`.

### Solução
Seguir o mesmo padrão já existente para "Canal" (`enrichDealsWithCanal`): criar uma função `enrichDealsWithProduct` e adicionar `product` como dimensão disponível para negócios.

### Alterações

**1. `src/components/insights/visual-builder/types.ts`**
- Adicionar na lista `deals.dimension`:
  ```
  { value: 'product', label: 'Produto', type: 'text' }
  ```

**2. `src/hooks/useVisualData.ts`**
- Criar função `enrichDealsWithProduct(accountId, deals)` que:
  - Busca valores de `deal_field_values` onde `field_id = ITEM_VENDA`
  - Se o valor for UUID válido → busca nome do produto na tabela `products`
  - Se não for UUID → resolve label via opções do campo personalizado (legado)
  - Injeta campo `product` em cada deal
- Em `fetchDealsData`, adicionar bloco (similar ao de `canal`):
  ```typescript
  if (dimension.field === 'product') {
    const enrichedData = await enrichDealsWithProduct(accountId, filteredData);
    return aggregateData(enrichedData, measure, dimension, dateDisplayFormat);
  }
  ```
- Em `getGroupKey`, adicionar:
  ```typescript
  if (field === 'product') return item.product || 'Não informado';
  ```

**3. `src/hooks/useStackedVisualData.ts`**
- Adicionar enriquecimento de produto quando `dimension.field === 'product'` ou `stackBy === 'product'`, seguindo o padrão do Canal.

