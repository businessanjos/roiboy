

## Corrigir exibicao de UUID no badge "Item da Venda"

### Problema

Alguns negocios armazenam o UUID de um produto diretamente no campo "Item da Venda" (em vez de um valor de opcao do campo personalizado). O codigo atual tenta mapear o valor para um label de opcao, mas quando nao encontra, exibe o valor bruto -- resultando em UUIDs visiveis nos cards.

### Solucao

Apos montar o mapa de opcoes, identificar valores que nao foram resolvidos (continuam como UUID) e buscar os nomes correspondentes na tabela `products`.

### Mudanca

**`src/components/sales/DealKanban.tsx`** - Na funcao `fetchFieldMap`, apos montar o mapa inicial, adicionar logica especifica para o campo "Item da Venda":

1. Coletar os valores que parecem ser UUIDs (nao resolvidos pelo `optionMap`)
2. Buscar os nomes na tabela `products` com `.in("id", uuids)`
3. Substituir os UUIDs pelos nomes dos produtos no mapa final

```text
Fluxo:
value_text -> optionMap[value_text] encontrado? -> usa label
value_text -> nao encontrado, parece UUID? -> busca em products -> usa product.name
value_text -> nenhum match -> exibe value_text original
```

### Escopo

| Arquivo | Mudanca |
|---------|---------|
| `DealKanban.tsx` | Adicionar resolucao de UUIDs de produtos apos montagem do mapa de "Item da Venda" |

Apenas um arquivo modificado. A logica de fallback para produtos sera aplicada somente ao campo `ITEM_VENDA_FIELD_ID`.

