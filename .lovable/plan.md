

## Corrigir tags de "Item da Venda" nos cards do pipeline

### Problema identificado

Os cards de negocio no pipeline nao exibem as tags de "Item da Venda" (e possivelmente "Faturamento Atual"). O problema esta no componente `DealKanban.tsx` que faz a busca em lote dos valores desses campos usando `.in("deal_id", dealIds)` com **628 IDs de deals**. 

Quando o array de IDs e muito grande, a query do Supabase pode falhar silenciosamente porque a URL da requisicao excede os limites permitidos (o filtro `.in()` e codificado como parametro GET na URL). O resultado e que `faturamentoMap` e `itemVendaMap` ficam vazios, e nenhuma tag aparece nos cards.

### Solucao

Particionar (chunk) os arrays de IDs em lotes menores antes de fazer as queries, garantindo que cada requisicao fique dentro dos limites seguros. Alem disso, adicionar tratamento de erro para evitar falhas silenciosas no futuro.

### Alteracoes

#### 1. `src/components/sales/DealKanban.tsx`

- Criar uma funcao utilitaria `chunkedIn` que divide arrays grandes em lotes de ate 200 IDs e executa as queries em paralelo, combinando os resultados
- Aplicar essa funcao dentro de `fetchFieldMap` para a query de `deal_field_values`
- Aplicar tambem em `resolveProductUUIDs` para a query de `products`
- Adicar `try/catch` ao redor do `Promise.all` para logar erros em vez de falhar silenciosamente
- Estabilizar a dependencia do `useEffect` usando um hash/stringify dos IDs dos deals em vez do array `deals` inteiro, evitando re-execucoes desnecessarias

### Secao tecnica

```text
Antes (falha com 628+ IDs):
  supabase.from("deal_field_values").in("deal_id", [628 UUIDs])
  -> URL muito longa -> falha silenciosa -> mapa vazio

Depois (chunks de 200):
  supabase.from("deal_field_values").in("deal_id", [200 UUIDs])  // chunk 1
  supabase.from("deal_field_values").in("deal_id", [200 UUIDs])  // chunk 2
  supabase.from("deal_field_values").in("deal_id", [200 UUIDs])  // chunk 3
  supabase.from("deal_field_values").in("deal_id", [28 UUIDs])   // chunk 4
  -> Combinar resultados -> mapa completo
```

Nenhuma alteracao no `DealCard.tsx` e necessaria — ele ja renderiza `itemVendaLabel` corretamente quando o valor e passado.

