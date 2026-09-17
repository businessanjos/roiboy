# Filtro de período na lista de Clientes

Adicionar um filtro de período na barra de filtros da tela de Clientes, ao lado de "Faturamento: todos".

## Como vai funcionar

Novo seletor "Período" com as opções:

- Todo o período (padrão, comportamento atual)
- Hoje
- Últimos 7 dias
- Últimos 30 dias
- Mês atual
- Mês passado
- Personalizado (escolher data inicial e final no calendário)

A data considerada é a da **última atualização do cliente** (última movimentação registrada na ficha), conforme definido.

Regras:

- O filtro vale para todas as abas (Ativos, Aguardando Contrato, Hold, Cancelados) e é aplicado junto com os demais filtros.
- Os números das abas passam a refletir o período escolhido.
- Aparece como etiqueta em "Filtros ativos", com botão para remover, e entra no contador de filtros e no "Limpar".
- A escolha fica salva por usuário, como os outros filtros da tela.
- A exportação respeita o período selecionado.

## Detalhes técnicos

- `src/pages/Clients.tsx`: novos estados `filterPeriod` (persistido via `usePersistedFilter`) e, para o modo personalizado, `filterPeriodStart`/`filterPeriodEnd`. Cálculo do intervalo com `date-fns` (`startOfDay`, `startOfMonth`, `subDays`, `subMonths`, `endOfMonth`), enviando `updated_from`/`updated_to` em ISO nos params de `fetchClients`, `fetchTabCounts` e na exportação; incluir os novos estados no `useEffect` de refetch, no `activeFilterCount`, no `clearAllFilters` e nos badges de filtros ativos.
- Seletor de período com `Select` para os presets e, no modo personalizado, `Popover` + `Calendar` em `mode="range"` (classe `pointer-events-auto`), no padrão já usado em `ContractsDateFilter`.
- `supabase/functions/list-clients/index.ts`: ler `updated_from`/`updated_to` e aplicar `.gte`/`.lte` sobre `clients.recent_activity_at` (campo preenchido em 100% dos 1.438 clientes; a tabela `clients` não possui `updated_at`). Sem alteração de RLS ou de qualquer outro filtro existente.
