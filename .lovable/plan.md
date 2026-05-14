## Objetivo

Transformar `/operations/onboarding` num cockpit operacional inteligente: visão Kanban + Pipeline + Dashboard, com SLA por etapa, alertas automáticos de gargalo e IA generativa que orienta o consultor cliente-a-cliente.

## Entregáveis

### 1. Schema (migração)
Adições ao banco para destravar SLA, rastreio temporal e cache de IA:

- `client_stages`:
  - `sla_hours INT` — prazo esperado nessa etapa (default 72h, configurável por etapa).
  - `description TEXT` — explica o que precisa ser feito.
  - `icon TEXT` — ícone lucide opcional por etapa.

- `clients`:
  - `onboarding_started_at TIMESTAMPTZ` — quando entrou no onboarding (preenchido na transição "ganho → cliente").
  - `stage_changed_at TIMESTAMPTZ` — quando mudou para a etapa atual (trigger atualiza).
  - `onboarding_health TEXT` — `on_track | at_risk | overdue | done` (calculado por trigger comparando `now() - stage_changed_at` vs `sla_hours`).
  - `ai_next_step TEXT` + `ai_next_step_at TIMESTAMPTZ` — cache do próximo passo sugerido pela IA.

- Trigger `update_client_stage_changed_at`: atualiza `stage_changed_at` em qualquer UPDATE de `stage_id`.
- Trigger `compute_onboarding_health`: roda no UPDATE/INSERT e em job pg_cron a cada hora para recalcular saúde de toda a base ativa.
- Função `set_onboarding_started_when_won()`: dispara quando deal vira `won` e cria/atualiza `clients.onboarding_started_at` se ainda nulo.

### 2. Edge function `onboarding-ai-coach`
Nova função em `supabase/functions/onboarding-ai-coach/index.ts` usando Lovable AI Gateway (`google/gemini-3-flash-preview`):

- **Inputs**: `clientId`, `mode` ∈ `next_step | risk_analysis | welcome_message | summary`.
- **Coleta server-side**: dados do cliente, briefing operacional, deal ganho, produto, timeline (últimas 30 entradas), checklist da etapa atual, dias parado.
- **Output (tool calling)**: JSON estruturado com `action`, `priority`, `message`, `risks[]`, `confidence`.
- Salva resultado em `clients.ai_next_step` (TTL 24h) para evitar re-chamadas.
- Trata 429/402 e devolve toast amigável.

### 3. UI: novo Hub `/operations/onboarding`
Reescrita de `ClientOnboardingHub.tsx` com 3 modos via tabs internas (sub-nav vertical não cabe aqui, então tabs de view):

#### a. **Visão Kanban** (default)
- 13 colunas (uma por etapa) com header colorido (`stage.color`), contador, SLA médio e barra de saúde verde/âmbar/vermelho.
- Cards ricos: avatar, nome (+VipBadge), produto (badge colorido), consultor responsável, dias na etapa com cor (verde <50% SLA, âmbar 50-100%, vermelho >100%), mini-progress do checklist, ícone alerta IA se `at_risk`.
- Drag-and-drop entre colunas (`@dnd-kit/core` já presente) → atualiza `stage_id` e dispara automação existente.
- Click no card abre **Drawer lateral** com: progresso, checklist interativo, painel "🧠 Coach IA" (próximo passo, riscos), botão para gerar mensagem de boas-vindas e ações rápidas (abrir cliente, WhatsApp, agendar).

#### b. **Visão Pipeline (atual orquestrado)**
- Mantém `OnboardingOrchestrated` para quem prefere tabela densa, mas com colunas extras: Saúde, Dias na etapa, Consultor.

#### c. **Dashboard de Saúde**
- KPIs no topo: novos (7d), em andamento, atrasados, tempo médio de onboarding completo, taxa de conclusão (ganhou contrato → chegou em "Plano de Ação 1") nos últimos 90 dias.
- Funil horizontal mostrando quantos clientes em cada etapa + tempo médio.
- Top 3 gargalos (etapas com maior tempo médio).
- Ranking de consultores (média de dias até concluir, conclusões no mês).

### 4. Sidebar: badge inteligente
- Atualizar `usePendingOnboardingCount` para retornar também `overdueCount`.
- Em `Sidebar.tsx`, badge âmbar para `newCount` + dot vermelho extra se houver `overdueCount > 0`.

### 5. Notificações
- Trigger no banco: quando `onboarding_health` virar `overdue`, insere notificação para `responsible_user_id` com tipo `onboarding_overdue`. Reaproveita sistema de notificações existente.

## Detalhes técnicos

- **Drag-and-drop**: usa `@dnd-kit/core`+`@dnd-kit/sortable` (já em uso em outros Kanbans do projeto).
- **Drawer lateral**: shadcn `Sheet` `side="right"` `className="w-[480px]"`.
- **IA cache**: `ai_next_step_at` é checado no front; só re-chama se >24h ou se `stage_id` mudou desde então.
- **RLS**: novas colunas herdam policies de `clients`/`client_stages` (já account-scoped). Cron job roda como `service_role`.
- **Defaults da migração**: `sla_hours` por etapa será preenchido com sugestões iniciais (Boas-vindas: 24h, Cadastro: 48h, Agendamentos: 72h, Onboardings com consultor/ferramentas: 120h, Plano de Ação: sem SLA).
- **Performance**: Kanban usa React Query com `staleTime: 30s` e realtime no `clients` para refletir drag-drop entre usuários.

## Fora do escopo

- Atribuição automática round-robin (mantém atual).
- Pesquisa de NPS ao final do onboarding (fica para fase 2).
- Integração com Daily.co para call de onboarding (fica para fase 2 — já discutido em mensagem anterior).

## Ordem de execução

1. Migração (schema + triggers + cron) — pede aprovação.
2. Edge function `onboarding-ai-coach`.
3. Hook `useOnboardingHub` (queries + realtime).
4. Componente `OnboardingKanban.tsx` + `ClientOnboardingDrawer.tsx`.
5. Componente `OnboardingDashboard.tsx`.
6. Reescrita de `ClientOnboardingHub.tsx` com Tabs (Kanban / Pipeline / Saúde).
7. Update `usePendingOnboardingCount` + Sidebar badge.
8. Memória `mem://features/operations/onboarding-hub-pt.md` atualizada para v2.

Estimativa: entrega grande (5-7 turnos), cada bloco testado isoladamente antes do próximo.
