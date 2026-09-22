# Item da Venda aparecendo vazio nos negócios ganhos

## O que está acontecendo

O dado **não foi perdido**. Conferi o negócio `[TRAF-IMP-EC] Andressa Cabral`: o Item da Venda continua gravado como **RM l Rykas Mentoring** (por isso aparece corretamente no topo da ficha, no campo "Item"). O que falha é só a exibição dentro de "Campos Personalizados".

Motivo: o produto está gravado de duas formas diferentes no sistema.

- A lista de opções do campo usa apelidos de texto (`rykas_mentoring`, `eternum_club`, ...).
- Ao ganhar o negócio (e em vários fluxos automáticos), o sistema grava o **código do produto** em vez do apelido.

O bloco de campos personalizados só sabe casar apelidos, então quando encontra um código não acha a opção e mostra "—".

Tamanho do problema hoje: 780 negócios estão com o produto gravado em código, sendo **213 negócios ganhos** — exatamente o grupo que o time vê vazio. Outros 2.239 estão com apelido e aparecem normalmente.

## O que vamos fazer

1. **Voltar a mostrar o produto em todos os negócios**: o campo Item da Venda passa a entender os dois formatos (código e apelido) na hora de exibir a badge colorida, tanto na ficha do negócio quanto nas listas que usam o mesmo bloco de campos.
2. **Manter a escolha certa ao editar**: ao abrir o campo para trocar, a opção atual já aparece marcada mesmo quando está gravada em código, evitando que alguém "perca" o valor ao salvar sem querer.
3. **Não alterar o dado gravado**: nenhuma migração em massa. Os registros continuam como estão; só a leitura passa a reconhecer os dois formatos.
4. **Cobrir os demais pontos de leitura** que hoje usam só o apelido, para o produto aparecer igual em ficha, exportação e telas de vendas.

## Detalhes técnicos

- Campo: `custom_fields` id `033b91fb-3add-4c96-aec9-567fefbd0fb2`, tipo `select`, `options[].value` com slugs; `deal_field_values.value_text` ora com slug, ora com UUID de `products`.
- Criar um resolvedor bidirecional em `src/lib/sales/itemVendaResolver.ts`: além do já existente `resolveItemVendaToProductId`, expor `resolveItemVendaOptionValue(raw, options)` que, dado um UUID, devolve o `option.value` equivalente (via mapa slug→UUID invertido) e, dado um slug, devolve ele mesmo.
- Aplicar em `src/components/custom-fields/DealFieldValueEditor.tsx` (render da badge e estado `localValue`/seleção) e em `src/components/custom-fields/FieldValueBadge.tsx` quando `field.id` for o de Item da Venda.
- Fallback final: se o UUID não estiver no mapa, buscar `products.name` + `products.color` e renderizar a badge com a cor do produto (regra de badge por produto já vigente no ROY).
- Sem migration, sem alteração de RLS.
