# INVENTÁRIO DE PAGINAÇÃO (auditoria a partir do código real)

> **Inventário PARCIAL.** A tabela da seção 2 lista apenas cerca de 25 áreas representativas; não é uma cobertura documental completa de todas as listagens do sistema.

Levantamento feito via `rg` sobre o código-fonte (não sobre documentação anterior), buscando:
`usePagedList`, `PagerFor`, `ListPagination`, `useTablePagination`, `TablePagination`,
`usePaginationState`, `.range(...)` com `count`, `fetchAllRows`, `rpc(...)` com
`p_offset`/`p_limit`, e os padrões "Carregar mais"/`loadMore`.

## 1. Mecanismos existentes no código

| Mecanismo | O que faz | Implementação |
| :--- | :--- | :--- |
| **LOCAL sobre fonte completa** | Busca todo o universo de dados (direto ou via `fetchAllRows` em lotes com `.range`) e pagina a exibição em memória com `usePagedList`/`usePaginationState` + `PagerFor`. | `src/hooks/usePagedList.ts` (hook), `src/components/ui/list-pagination.tsx` (`ListPagination`/`PagerFor`), `src/hooks/useTablePagination.ts` e `src/components/ui/table-pagination.tsx` (wrappers de compatibilidade que delegam para os dois primeiros). |
| **SERVIDOR count+range** | Cada página é buscada do banco com `.select(..., { count: "exact" }).range(from, to)`; o total vem do próprio `count`. | Query direta no componente/hook, sem carregar o universo completo. |
| **SERVIDOR RPC offset/limit** | RPC recebe `p_offset`/`p_limit` e devolve só a página (geralmente com `total_count` embutido em cada linha). | `supabase.rpc(...)` com esses parâmetros. |
| **CURSOR / "Carregar mais"** | Botão "Carregar mais" dispara novo `.range(offset, offset+size-1)` no servidor e concatena ao estado já carregado (sem recarregar do zero). | Função local com `offset` controlado em estado/ref. |
| **"Carregar mais" LOCAL** | Todo o dataset já está em memória (via hook de dados); o botão só aumenta um contador de itens *visíveis* no array já carregado — não faz nova requisição. | `visibleCounts`/contador local. |

## 2. Inventário por tela (arquivo real → mecanismo)

| Componente / arquivo | Lista / aba | Mecanismo | Fonte dos dados | Ordem estável |
| :--- | :--- | :--- | :--- | :--- |
| `src/pages/ClientCheckpoints.tsx` | `/clients/checkpoints` | **LOCAL** (`usePagedList(filtered, ...)`, linha 142) | `useCheckpointsPanel`/`useCheckinsReport` (`src/hooks/useClientCheckins.tsx`) via `fetchAllRows` em lotes | Com desempate: `.order("happened_at").order("id")` / `.order("id", { ascending: true })` nos lotes de `fetchAllRows` |
| `src/pages/ClientOnboardingHub.tsx` | `/operations/onboarding` | **LOCAL** (`usePagedList(clients, ...)`, linha 351) | `useOnboardingHub` (`src/hooks/useOnboardingHub.tsx`) via `fetchAllRows` | Com desempate: `.order("stage_changed_at").order("id")` (linhas 97-98) |
| `src/pages/events/EventsPlaybooks.tsx` | `/events/playbooks` (catálogo e itens de um playbook) | **LOCAL** (`usePagedList(playbooks, ...)` e `usePagedList(items, ...)`, linhas 82-83) | `fetchAllRows` direto no componente (linha ~88 e ~100), consultando `event_playbooks`/itens | Com desempate: `.order("created_at").order("id")` (playbooks); `.order("days_offset").order("position").order("id")` (itens, linhas 113-115) |
| `src/hooks/useNotificationsHistory.ts` + `src/pages/Notifications.tsx` | `/notifications` | **SERVIDOR count+range** (`useNotificationsHistoryPage`, linha 142: `.select(..., { count: "exact" }).order("created_at", { ascending: false }).range(from, to)`) | Query direta na tabela `notifications` | Com desempate: `.order("created_at").order("id")` (linhas 146-147) |
| `src/hooks/useNotificationsHistory.ts` (`useNotificationTabCounts`) | Badges de contagem por aba em `/notifications` | RPC `get_notification_tab_counts` — **apenas contagem** (`unread_count` por aba), não pagina linhas | RPC | N/A (não retorna linhas) |
| `src/pages/Tasks.tsx` + `src/lib/tasks/searchTasksRpcParams.ts` | `/tasks` (com termo de busca) | **SERVIDOR RPC offset/limit** — `search_tasks_page` com `p_limit`/`p_offset` e `total_count` por linha (linhas ~354-389 de `Tasks.tsx`) | RPC devolve só IDs da página; linhas completas são hidratadas em lotes de 150 via `.in("id", ...)` | Ordem definida dentro da RPC (não visível no front) |
| `src/pages/Tasks.tsx` (sem termo de busca) | `/tasks` | **CURSOR / "Carregar mais"** (botão "Carregar mais tarefas", linhas 2399/2483) | Query direta com filtros de setor/usuário, carregada em blocos sob demanda | Depende do `.order` aplicado na query de blocos (não usa RPC) |
| `src/components/admin/AuditLogViewer.tsx` | `/admin` (aba Auditoria) | **SERVIDOR RPC offset/limit** — `audit_unified_page` com `p_offset`/`p_limit` e `total_count` (linhas 266-280); exibida com `ListPagination` | RPC | Ordem definida dentro da RPC |
| `src/components/settings/SecurityAuditViewer.tsx` | Configurações → Auditoria de Segurança | **SERVIDOR RPC offset/limit** — `search_security_audit` com `p_offset`/`p_limit` e `total_count` (linhas 63-70) | RPC | Ordem definida dentro da RPC |
| `src/pages/RoyZappAttendanceMetrics.tsx` | Métricas de atendimento (RoyZapp) | **LOCAL** (`usePagedList(sorted, ...)`, linha 158) | Array já ordenado/calculado em memória a partir de RPCs de métricas | Depende da ordenação local aplicada a `sorted` antes de paginar |
| `src/pages/Contracts.tsx` | `/contracts` | **LOCAL** via `fetchAllRows` (linhas 596-606) + `ListPagination` (import linha 1, render ~2102) | `fetchAllRows` sobre `contracts` | Com desempate: `.order("created_at").order("id")` |
| `src/pages/SalesPipeline.tsx` | Lista de negócios (visão em lista, fora do Kanban) | **LOCAL** (`usePagedList(deals, ...)`, linha 3245) | Array de `deals` já carregado no estado do Kanban (não busca página isolada) | Depende da ordenação aplicada a `deals` antes de paginar |
| `src/pages/BriefingLinkAudit.tsx` | Auditoria de links de briefing | **LOCAL** (`usePagedList`/`PagerFor`) sobre dataset de `fetchAllRows` (linha 89) | `fetchAllRows` | Verificar `.order` da query em `fetchAllRows` (linha ~89) |
| `src/pages/DoubleChairList.tsx` | Lista de pares (Double Chair) | **LOCAL** (`usePagedList(pairs, ...)`, linha 53) | `fetchAllRows` (linhas 30-45) | Conforme `.order` da query (linha ~45) |
| `src/pages/ClinicaRyka.tsx` | Clientes/Provisões da Clínica Ryka | **LOCAL** (`usePagedList`/`PagerFor`) | `fetchAllRows` (múltiplas consultas, linhas 81-110+) | Conforme `.order` de cada consulta |
| `src/pages/MentoriaEC.tsx` | Contratos/itens da Mentoria EC | **LOCAL** (`usePagedList`/`PagerFor`) | `fetchAllRows` (linhas 126, 276) | Conforme `.order` de cada consulta |
| `src/pages/Forms.tsx` | `/forms` (catálogo de formulários) | **LOCAL** (`usePagedList(filteredFormsForPaging, ...)`, linha 616; `PagerFor` linha 1481) | Lista de formulários carregada na própria página | Conforme a query do catálogo |
| `src/components/renewals/RenewalLosses.tsx` | Motivos de perda de renovação | **LOCAL** (`usePagedList(sortedItems, ...)`, linha 541) | `fetchAllRows` (linha 245) | Conforme `.order` da query de `outcomes` |
| `src/pages/Renewals.tsx` | Futuros/expirados/sucessores de renovação | **LOCAL com paginação manual** (função de lista com `setPage`/`safePage` e botões anterior/próxima, linhas ~640-835; não usa `usePagedList`/`PagerFor`) | `fetchAllRows` (3 consultas, linhas 210-263+) | Conforme `.order` de cada consulta |
| `src/pages/VipClients.tsx` | Clientes VIP | **LOCAL** (`usePagedList`/`PagerFor`) | `fetchAllRows` (linhas 107-118+) | Conforme `.order` de cada consulta |
| `src/pages/GestaoTech.tsx` | Projetos de tecnologia | **LOCAL** (`usePagedList(filteredProjects, ...)`, linha 140) | `fetchAllRows` (linha 121) | Conforme `.order` da query |
| `src/components/client/ClientFormResponses.tsx` | Respostas de formulário (ficha do cliente) | **LOCAL** (`usePagedList(formResponses, ...)`, linha 91) | `fetchAllRows` (linha 136) | Conforme `.order` da query |
| `src/components/client/ClientFollowup.tsx` | Comentários/follow-ups (ficha do cliente) | **CURSOR / "Carregar mais"** (`fetchFollowups(loadMore)`, `loadMoreFollowups`, linhas 188-362) | `.select(..., { count: "exact" }).order("created_at", ...).range(offset, offset+PAGE_SIZE-1)` direto na tabela `client_followups` (linha ~208) | **Sem desempate por id** — ordena só por `created_at` |
| `src/pages/ClientDetail.tsx` (Timeline) | Timeline do cliente | **CURSOR / "Carregar mais"** (`loadMoreTimeline`, linhas 1214-1260) | 6 fontes paginadas independentemente (`message_events`, `client_life_events`, `form_responses`, `attendance`, `client_subscriptions`, `client_checkins`), cada uma com `.range(from, to)` e `offset` próprio em `timelinePageRef` | Com desempate: todas as 6 consultas usam `.order(<coluna de data>, ...).order("id", ...)` |
| `src/pages/financial/FinancialDunningKanbanPage.tsx` | Kanban de cobrança (Dunning) | **"Carregar mais" LOCAL** (`visibleCounts`/`loadMore`, linhas 356-363) — não refaz query, só revela mais itens do array `cases` já carregado | Query de `cases` fora deste trecho (dataset completo por coluna do Kanban) | Depende do `.order` da query de `cases` |
| `src/components/marketing/agencies/MaterialRequestsList.tsx` | Solicitações de material por agência | **"Carregar mais" LOCAL** (`visibleCounts`, linha ~30, botão linha 114) — fatia em memória o array já retornado por `useMaterialRequests` | `useMaterialRequests` (react-query, sem paginação de servidor) | Depende do `.order` do hook `useMaterialRequests` |

## 3. Não aplicáveis (com motivo concreto verificado no código)

- **Gráficos e dashboards** (ex.: `RHDashboard`, cards de `MarketResearchTab`, `ThreeCPlusMetrics` agregados): exibem agregações já calculadas no banco ou em memória; não há lista de linhas a paginar.
- **Kanbans com drag-and-drop** (`SalesPipeline` — quadro Kanban, `FinancialDunningKanbanPage` — quadro de colunas): a ordenação visual é definida pelo usuário via arraste; paginar romperia a view de colunas. Onde excede uma contagem fixa por coluna, usam "Carregar mais" LOCAL (ver tabela acima), não paginação de servidor.
- **Calendário** (telas de agenda/calendário de eventos): navegação por período (dia/semana/mês) substitui paginação linear por página numerada.

## 4. Limitações conhecidas (verificadas, não presumidas)

- **Teste `briefingRls`**: `src/test/rls/briefingRls.test.ts` depende de um usuário com papel **SDR não-admin**, que não existe no ambiente de teste atual (o arquivo cobre Vendas/SDR/Operações e o caso de controle negativo "sem nenhum desses papéis"; o cenário específico de SDR não-admin não tem fixture correspondente no ambiente).
- **Playbooks — catálogo vazio**: verificado na UI em 393px, o catálogo de `/events/playbooks` mostra o estado vazio "Nenhum playbook" **sem rodapé de paginação**. O motivo é o catálogo vazio (nenhum registro), não "caber em uma página": `PagerFor` aparece sempre que há registros.

## Revisão 6f068a4 (correções pontuais)
- `src/pages/financial/FinancialPluggyStatusPage.tsx` · SyncHistoryDialog: total derivado de `data.total` no cache (reabertura/troca de conta). Teste `PluggySyncHistoryDialog.test.tsx`.
- `src/pages/financial/FinancialFaqPage.tsx`: artigos via `fetchAllRows` com ordem `display_order, question, id`; erro propagado.
- `src/pages/VipClients.tsx`: try/catch/finally; erro visível, dados anteriores preservados. Teste `VipClients.loadError.test.tsx`.
- `src/lib/fetchInChunks.ts` · `fetchAllInChunks`: lote de IDs + `fetchAllRows` por lote. Usado em `MentoriaEC.tsx` (presenças, status) e `Renewals.tsx` (sucessores, produtos fallback, outcomes). Teste com lote de 1201.
- `src/components/events/EventChecklistTab.tsx`: spinner só na primeira carga; refetch preserva grupos e página. Teste 45 itens/página 2.
- RPCs `audit_unified_page`/`audit_unified_authors`: `deals.deleted_by` (auth.users) resolvido via `users.auth_user_id` da mesma conta; actor e escopo comercial usam `users.id`.

## 5. Ajustes da revisão 15aea12

- Filtro **Pessoas** da auditoria (`audit_unified_authors`) reutiliza `audit_unified_page` com o mesmo predicado (sem filtro de pessoa) e devolve uma opção por `user_id`, com nome/e-mail do registro mais recente.
- Sino de notificações: em UPDATE sem linha, erro ou UPDATE realtime externo, a contagem é reconciliada pela contagem do servidor, sem +1/-1 às cegas.
