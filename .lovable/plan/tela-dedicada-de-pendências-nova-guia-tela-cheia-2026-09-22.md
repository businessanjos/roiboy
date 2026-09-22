# Tela dedicada de pendências (nova guia, tela cheia)

Hoje a lista de pendências abre numa janelinha, carrega só os 300 primeiros registros e a busca enxerga apenas o que já foi carregado. Com 2.236 tarefas do George isso não serve. A proposta é transformar isso numa página inteira, em nova guia, com paginação de verdade e seleção item a item.

## Nova página em tela cheia

Rota nova `/settings/team/pendencias?user=<id>&item=<chave>`, aberta em nova guia pelo botão "Ver" da janela de inativação.

Layout:
- Topo: nome e e-mail do membro, área/tipo da pendência, a regra escrita ("o que conta como em aberto") e o total real.
- Barra de filtros: busca por título, filtro por situação, filtro por período (vencimento/criação), ordenação (mais recentes, mais antigos, título, vencimento).
- Coluna lateral de agrupamento por título: mostra os blocos repetidos com contagem ("Follow Up — 812", "Ligação não atendida — 640", "Primeiro Contato — 210"). Um clique filtra; outro clique desmarca o grupo inteiro de uma vez.
- Tabela com caixa de seleção por linha, "selecionar tudo desta página" e "selecionar todos os X do filtro atual".
- Rodapé fixo: "X de Y selecionados para transferir · Z ignorados", botões Salvar seleção, Limpar e Exportar CSV (do filtro atual).

## Paginação e busca de verdade

A busca e os filtros passam a rodar no servidor, não sobre uma amostra. Páginas de 50/100/200 registros com navegação e contagem total, então dá para percorrer os 2.236 sem travar.

## O que abre como padrão

- Só o que está realmente em aberto hoje (a mesma regra de sempre) e, além disso, as linhas de rotina genérica de prospecção ("Follow Up", "Ligação não atendida", "Primeiro contato", "Sem resposta", "Tentativa de contato") já vêm **desmarcadas**, com um aviso no topo: "N linhas de rotina de prospecção foram desmarcadas automaticamente — revise se quiser incluir".
- O gestor pode marcar/desmarcar qualquer linha ou grupo. Nada é apagado: desmarcar significa apenas "não transferir, fica como está".

## Como a seleção volta para a inativação

O que o gestor decidir na guia é salvo e volta automaticamente para a janela de inativação (atualiza sozinha, sem recarregar). Cada área passa a mostrar "1.402 de 2.236 selecionados" e o resumo por destinatário no rodapé usa esse número. A transferência move exatamente as linhas marcadas.

## Detalhes técnicos

- Edge function `deactivate-team-user`:
  - `list_open_items` ganha `page`, `page_size` (50/100/200), `search` (ilike nas colunas de título do `LIST_META`), `status`, `sort` e retorna `{ rows, total, page, page_size }` usando `count: "exact"` + `.range()`.
  - nova ação `title_groups`: agrupa por título com contagem (consulta paginada agregada no servidor, teto de 5.000 linhas lidas).
  - `Assignment` passa a aceitar `{ key, to_user_id, mode: "all" | "only" | "except", ids?: string[] }`. `transferItem` aplica `.in("id", ids)` ou `.not("id","in",...)`, em lotes de 200 ids para não estourar a URL; o retorno `moved` continua sendo a contagem real atualizada.
  - Auditoria ganha `mode` e `excluded_count` por destinatário.
- Front:
  - nova página `src/pages/settings/TeamOpenItems.tsx` + rota em `App.tsx` (mesma proteção de admin já usada em Configurações).
  - `src/lib/settings/openItemsSelection.ts`: persistência em `localStorage` por `userId:itemKey` no formato `{ mode, ids }` e `BroadcastChannel("open-items-selection")` para avisar a janela aberta.
  - `OpenItemsViewerDialog.tsx` é removido; `DeactivateUserDialog.tsx` passa a abrir a guia (`window.open`), ouvir o canal, exibir "selecionados/total" por linha e montar o payload com `mode`/`ids`.
- Sem migração, sem mudança de RLS: tudo continua passando pela edge function com verificação de administrador da mesma conta.
