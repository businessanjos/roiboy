# INVENTÁRIO ATUAL DE PAGINAÇÃO

Este documento registra o estado real da paginação no sistema, consolidando padrões e inventariando o comportamento de cada tela após a auditoria técnica.

## 1. Padrão Técnico

### Componentes e Hooks
- **`usePagedList` / `useTablePagination`**: Hooks principais para gerenciar estado de página, limite e carregamento.
- **`PagerFor` / `ListPagination`**: Componentes de interface que exibem a faixa de registros (ex: "1–20 de 203") e controles de navegação.
- **`usePaginationState`**: Utilizado para persistência simples de estado de página.
- **`fetchAllRows` / `fetchInChunks`**: Helpers para casos onde a carga completa é necessária para processamento local (DREs, exportações específicas).

### Regras de Ouro
1.  **Filtros Primeiro**: Qualquer alteração de filtro ou busca reseta a navegação para a Página 1.
2.  **Ordem Estável**: Toda consulta paginada inclui `id` ou `created_at` na ordenação para evitar registros saltantes.
3.  **Erro Explícito**: Falhas de rede ou banco durante a troca de página são exibidas ao usuário, não resultando em listas vazias silenciosas.
4.  **Sem Teto Silencioso**: Removidos limites arbitrários (ex: `.limit(1000)`) que escondiam dados sem avisar o usuário.

---

## 2. Inventário por Setor

| Setor | Rota / Aba | Componente | Mecanismo |
| :--- | :--- | :--- | :--- |
| **Clientes** | `/clients/checkpoints` | `CheckpointsTable` | Servidor (count + range) |
| **Clientes** | `/operations/onboarding` | `OnboardingTable` | Servidor (count + range) |
| **Tarefas** | `/tasks` | `TasksTable` | Servidor (RPC `search_tasks_page`) |
| **Segurança** | `/admin` (Auditoria) | `AuditLogViewer` | Servidor (RPC `audit_unified_page`) |
| **Segurança** | Configurações | `SecurityAuditViewer` | Servidor (RPC `search_security_audit`) |
| **Notificações** | `/notifications` | `NotificationsHistory` | Servidor (RPC `get_notification_tab_counts`) |
| **Zapp** | Métricas | `RoyZappAttendanceMetrics` | Servidor (RPCs `zapp_attendance_metrics/daily`) |
| **Contratos** | `/contracts` | `ContractsTable` | Servidor (count + range) |
| **Eventos** | `/events/playbooks` | `EventsPlaybooks` | Servidor (count + range) |
| **CRM** | Pipeline / Kanban | `SalesPipeline` | Cursor / "Carregar mais" |
| **PDA** | Timeline / Feed | `PdaTimeline` | Cursor / Infinite Scroll |
| **RoyZapp** | Conversas | `ZappChat` | Cursor (Lazy loading histórico) |
| **Financeiro** | Cobrança (Dunning) | `FinancialCollections` | Cursor / Infinite Scroll |

### Não Aplicável (Motivo Técnico)
- **Gráficos e Dashboards**: Agregação total via banco (ex: RHDashboard).
- **DRE / Fluxo de Caixa**: Estrutura hierárquica que exige carga completa para cálculos de saldo.
- **Formulários**: Dados de referência para preenchimento.
- **Calendários**: Visualização por período (mês/semana) substitui a paginação linear.
- **Organograma / Árvore**: Navegação por profundidade, não por lista.
- **EverIA**: Interface de chat/agente via stream.

---

## 3. Exceções Justificadas

Permanecem com limites técnicos específicos por design de performance ou UX:
- **Seletores de Busca**: Filtros RoyZapp limitados a 500 registros para evitar travamento do browser em multi-selects gigantes.
- **Links de Call**: Amostra recente de links em `CallLinks`.
- **Insights**: Valores sugeridos em filtros limitados a 1000 entradas mais frequentes.
- **Amostra de Setores**: Zapp utiliza amostra para visualização rápida.
- **Resumos "Últimos N"**:
    - `content_platform_posts`: Últimos 100 posts (feed social).
    - Dashboard: Próximos 10 eventos.
    - Timeline PDA: 50 eventos mais recentes por carga.
- **Exportação TeamOpenItems**: Gera `p-N.csv` baseado na página atual da visualização por design do solicitante.
- **Gerador de Script**: Amostra proposital de variáveis para template.

---

## 4. Verificação Final

### Qualidade de Código
- **Build**: Vite build OK.
- **Tipagem**: `tsgo -p tsconfig.app.json` retornando 0 erros.
- **Lint**: `eslint rules-of-hooks` 0 violações nos arquivos alterados desde f96af873.
- **Testes**: Vitest `src` 224/225 passados (1 falha única `src/test/rls/briefingRls.test.ts` depende de usuário SDR não-admin inexistente no banco).

### Visual e Mobile
Navegador 393/320/1440 sem corte:
- **`/clients/checkpoints`**: "1–20 de 203" (antes 609px de largura, corrigido).
- **`/operations/onboarding`**: "1–20 de 31".
- **`/tasks`**: "1–20 de 682".
- **`/notifications`**: Paginado no servidor.
- **`/contracts`**: "1–6 de 6" (rodapé antigo substituído pelo padrão; mostra só a faixa quando cabe numa página).
- **`/events/playbooks`**: com 0 playbooks no banco (estado vazio; rodapé com faixa aparece quando há registros).

## Complemento final (revisão estática 1f6f)
| Área | Fonte / mecanismo | Verificação |
|---|---|---|
| Tarefas (busca) | RPC `search_tasks_page` com p_limit/p_offset e total_count — sem carregar lotes de 200k | teste: página 61 → offset 1200 |
| Negócios excluídos | busca por título, responsável e quem excluiu; mesmo `.or` em linhas e count (`deletedDealsFilter.ts`) | teste unitário |
| Pluggy status | invalida chaves reais; soma 24h via `fetchAllRows`; "Ver histórico" por conta com count+range | tipos |
| Consumidores `fetchAllRows` | erro propagado antes de publicar totais/exports (AttendanceReport, EventRoiTab, MarketingLinksUtm, ClientDetail, Clients e outros); desempate `.order('id')` | teste helper: 2500, erro lote 2, 51000 sem teto |
| Fontes completas | ClientFormResponses, Renewals (pendentes, expirados, sucessores em chunks), RenewalLosses, ClinicaRyka, DoubleChairList, MentoriaEC, useClientCheckins | testes com mocks em lotes |
| Páginas visuais | AdminPermissionsTab, ações LeaderMeetings, participantes Reminders, artigos por categoria no FAQ, modo lista MarketingTasks (Kanban intacto), itens por categoria no EventChecklist | lint hooks 0 |
