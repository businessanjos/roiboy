

## Corrigir visual empilhado com dimensão categórica (Produto + Faturamento Atual)

### Problema
`fetchStackedDealsData` assume que a dimensão (eixo X) é sempre temporal (data). Quando a dimensão é `product` (ou `canal`, `responsible`), a linha 180 define `dateField = 'product'`, e depois tenta filtrar por datas e fazer `parseISO` nesse valor — resultando em dados vazios.

### Causa raiz
Não existe um caminho categórico em `fetchStackedDealsData`, ao contrário de `fetchStackedLeadsData` que já possui essa lógica (linhas ~460-510 do mesmo arquivo).

### Correção

**Arquivo: `src/hooks/useStackedVisualData.ts` — função `fetchStackedDealsData`**

1. **Detectar se a dimensão é categórica**: Verificar se `dimension.type !== 'date'` ou se o campo é `product`/`product_name`/`canal`/`responsible` (campos não-data).

2. **Separar o dateField da lógica de filtro temporal**: Quando a dimensão é categórica, o dateField para filtros de data deve ser inferido do `statusFilter` (won_at, lost_at, created_at) — não do `dimension.field`.

3. **Adicionar caminho categórico**: Após o enriquecimento (produto, canal, custom field), quando a dimensão é categórica:
   - Agrupar deals pela categoria (ex: `deal.product`) no eixo X
   - Agrupar pela série (ex: `_custom_stack_label` do Faturamento Atual) para empilhamento
   - Construir `StackedDataPoint[]` com categorias como `name` e séries como chaves
   - Ordenar por total descendente (como já feito em leads)

4. **Manter caminho temporal inalterado**: O fluxo atual de agrupamento por períodos de data continua funcionando para dimensões temporais.

Mudanças concentradas em ~60 linhas dentro de `fetchStackedDealsData`:
- Linhas ~178-188: Não usar `dimension.field` como dateField quando é categórico
- Após linha ~251: Adicionar bloco `if (isCategoricalDimension)` com lógica de agrupamento categórico + return antecipado
- Helper `getCategoryValue(deal, field)` para resolver `product`, `canal`, `responsible`, etc.

