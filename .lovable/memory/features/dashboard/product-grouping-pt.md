---
name: Agrupamento de produtos no Dashboard CS
description: Dashboard de Customer Success agrupa produtos equivalentes (renovações REN. e rebranding Rykas -> Eternum) em um único card/filtro via src/lib/dashboard/productGroups.ts
type: feature
---

No Dashboard de CS, produtos equivalentes contam como um só:
- Eternum Mentoring = `EM l Eternum Mentoring` + `REN. EM l Eternum Mentoring (1)` + `RM l Rykas Mentoring` + `REN. RM l Rykas Mentoring`
- Eternum Club = `EC l Eternum Club` + `REN. EC l Eternum Club`
- Mesma regra vale para Private, Pass, etc.

Implementação: `src/lib/dashboard/productGroups.ts`
- `productGroupKey(name)` remove prefixo `REN.`, sufixo `(n)`, usa o rótulo após o separador `l`/`|` e mapeia `rykas mentoring -> eternum mentoring`, `rykas pass -> eternum pass`.
- `buildProductGroups(products)` retorna grupos com `memberIds`; o representante é o produto não-renovação.
- `clientInGroup(product_ids, memberIds)` para contagem/filtragem.

Nunca listar renovações como produto separado nos cards/filtros do dashboard.
