# Agências de Tráfego — Plano

Nova área em Marketing para cadastrar agências parceiras, comparar performance lado a lado e dar a elas um acesso restrito ao ROY para solicitar materiais.

## 1. Modelo de dados (1 migration)

**Novas tabelas (todas `account_id`-scoped, com RLS + GRANTs):**

- `traffic_agencies` — `id, account_id, name, color, contact_name, contact_email, contact_phone, notes, is_active, created_at, updated_at`
- `traffic_agency_members` — vincula `user_id` ↔ `agency_id` (um usuário pode ser de uma agência; tabela separada para evoluir para multi-agência depois)
- `marketing_material_requests` — `id, account_id, agency_id, requested_by_user_id, category` (enum: `criativo_estatico`, `video`, `copy`, `landing_page`, `outro`), `title, description, payload jsonb` (campos específicos por categoria), `status` (`aberto`, `em_producao`, `em_revisao`, `entregue`, `cancelado`), `priority, due_date, attachments jsonb, assigned_to_user_id, created_at, updated_at`
- `marketing_material_request_comments` — thread interno (`request_id, user_id, body, created_at`)

**Alterações em tabelas existentes:**

- `marketing_ad_sets` → adicionar coluna `agency_id uuid` (nullable) + `account_id uuid` (preencher via backfill do `user_id`→`users.account_id`) e ajustar RLS para `account_id`. Sem isso, agências veem só os ad sets do usuário que sincronizou Meta.
- `deals` → adicionar `agency_id uuid` (nullable) para atribuição direta de leads à agência (preenchido por regra: se `canal = trafego_pago` e existe ad set vinculado → usa agência do ad set; senão fica nulo e pode ser setado manualmente).

## 2. RBAC — papel "Agência"

- Criar `team_role` "Agência de Tráfego" (semente em migration).
- Helper novo `isTrafficAgencyUser(currentUser)` lendo `team_role_names`.
- Helper `getCurrentUserAgencyId()` lendo `traffic_agency_members`.
- Gate na sidebar do Marketing: usuário-agência vê apenas **Dashboard da Agência** e **Solicitações**. Demais setores ficam ocultos (já controlado por `user_sector_access` — Marketing como `viewer`).
- Filtro server-side: todas as queries de `marketing_ad_sets`, `deals`, `marketing_material_requests` aplicam `agency_id = currentUserAgencyId` quando o usuário é agência. Reforçado por RLS policy específica.

## 3. UI — área interna (admin/marketing)

Nova entrada na sidebar Marketing: **Agências** (`/marketing/agencias`).

### 3.1 `/marketing/agencias` — lista + CRUD
- Cards com nome, cor, contato, # campanhas ativas, investimento mês, leads mês.
- Dialog de criar/editar agência.
- Botão "Vincular usuário" abre seletor para criar `traffic_agency_members`.

### 3.2 `/marketing/agencias/:id` — detalhe da agência
Tabs:
- **Visão geral**: KPIs (Investimento, Leads, MQL, Vendas, CAC, ROAS, CPL) com seletor de período.
- **Campanhas**: tabela de `marketing_ad_sets` da agência com ranking por ROAS/CPL.
- **Funil**: Lead → MQL → SQL/Reunião → Venda com taxas entre etapas.
- **Solicitações**: lista de `marketing_material_requests` daquela agência.

### 3.3 `/marketing/agencias/comparativo` — comparação lado a lado
- Seletor multi-agência (padrão: todas ativas).
- Cards KPI lado a lado por agência.
- Gráfico de linha temporal (Recharts) — investimento, leads, MQL, vendas (seletor de métrica).
- Tabela de campanhas top de cada agência.
- Funil comparado.
- Reaproveita `useMarketingDashboardMetrics` parametrizado por `agencyId`.

## 4. UI — portal da agência

Quando um usuário-agência loga, é direcionado para `/marketing/portal-agencia` (rota nova):

- **Dashboard**: mesmos KPIs e gráficos da view interna, mas escopado à própria agência (sem ver outras).
- **Minhas campanhas**: tabela de ad sets.
- **Solicitar material**: botão grande que abre wizard tipado por categoria.
- **Minhas solicitações**: kanban (Aberto → Em produção → Em revisão → Entregue) das próprias solicitações, com comentários.

## 5. Solicitação de materiais — formulário tipado

Wizard em 2 passos:

1. **Categoria**: criativo estático, vídeo, copy, landing page, outro.
2. **Formulário específico** (salvo em `payload jsonb`):
   - **Criativo estático**: campanha alvo, formato (feed/story/reels), objetivo, headline, CTA, referências (upload), data desejada.
   - **Vídeo**: duração, plataforma, roteiro/ideia, voz-off (sim/não), referências, data.
   - **Copy**: canal (email/ads/lp), tom, número de variações, briefing.
   - **Landing page**: objetivo, produto, URL atual (se houver), seções desejadas, integrações.
   - **Outro**: descrição livre.

Workflow:
- Status inicial `aberto`, notifica time de Marketing.
- Marketing assume (`assigned_to_user_id`), move para `em_producao`.
- Entrega arquivo/link, move para `em_revisao` → agência aprova → `entregue`.
- Thread de comentários com anexos em ambos os lados.

## 6. Detalhes técnicos

- `useTrafficAgencies()` — lista com counts agregados.
- `useAgencyMetrics(agencyId, dateRange)` — encapsula leitura de `marketing_ad_sets` + `deals` filtrados.
- `useMarketingDashboardMetrics` ganha parâmetro opcional `agencyId`.
- Storage: bucket `material-requests` (RLS: agência só vê seus próprios anexos; marketing vê tudo da conta).
- Realtime no `marketing_material_request_comments` para chat ao vivo.
- Backfill: ad sets existentes ficam com `agency_id = null` (admin atribui depois pela UI).

## 7. Itens fora desse escopo (perguntar antes se quiser)

- Integração Google Ads (hoje só Meta existe).
- Atribuição automática de `deals.agency_id` por UTM — começamos com regra simples por ad set; UTM pode vir depois.
- SLA/automações de cobrança em solicitações atrasadas.

## 8. Ordem de execução

1. Migration (tabelas + colunas novas + RLS + GRANTs + seed do team role).
2. Helpers RBAC e hooks (`useTrafficAgencies`, `useAgencyMetrics`).
3. CRUD `/marketing/agencias` + vínculo de usuários.
4. Detalhe da agência + comparativo.
5. Portal externo da agência.
6. Sistema de solicitação de materiais (wizard + kanban + comentários).
7. Backfill manual via UI (você atribui as agências aos ad sets/contas existentes).
