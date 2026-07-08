# Fluxo End-to-End de Inativação de Colaboradores

## Situação atual

- Fonte de verdade decidida: `hr_collaborators.status = 'inactive'`.
- 6 colaboradores inativos hoje (Ana Sant'Anna, Dayara, Lena, Michele, Rosane, Vanessa) ainda aparecem em seletores, menções `@`, filtros, rankings e como responsáveis de leads/deals/clientes.
- Não existe função centralizada de inativação — cada tela filtra do seu jeito, muitas nem filtram.

## Regras de negócio

**Default de reatribuição por área** (aplicado quando o inativo é responsável em algum registro ativo):

| Origem | Vai para |
|---|---|
| Comercial (SDR, Closer, Head Comercial, Mentor) | Jonathan Marcato |
| CX / Operações / Onboarding | Andréia Barros |
| Financeiro / RH / Administrativo / Marketing | Maikol Parnow |
| Fallback (sem área identificada) | Jonathan Marcato |

Detecção de área usa `hr_collaborators.department` + `team_roles` do usuário.

## Backend — migração única

### 1. Função canônica de área
`public.get_default_reassignment_user(inactive_user_id uuid) returns uuid`
SECURITY DEFINER, lê `hr_collaborators.department` do inativo e retorna o `user_id` do herdeiro conforme tabela acima.

### 2. Função central de inativação
`public.inactivate_collaborator(collaborator_id uuid, reason text)` — SECURITY DEFINER. Passos, em transação:

1. Marca `hr_collaborators.status = 'inactive'`, `termination_date = today`.
2. Resolve `heir_user_id` via `get_default_reassignment_user`.
3. Reatribui tudo o que estava no inativo para o herdeiro:
   - `leads.responsible_user_id`, `sdr_user_id`
   - `deals.responsible_user_id`, `sales_user_id`, `sdr_user_id`
   - `clients.responsible_user_id`
   - `client_contracts.responsible_user_id`
   - `internal_tasks.assigned_to`
   - `client_followups.user_id` (apenas os `status = 'pending'`)
   - `zapp_conversation_assignments.assigned_user_id` (apenas ativas)
   - `deal_activities` pendentes
4. Revoga acesso: `users.role = 'inactive'`, deleta `user_sessions`, `push_subscriptions`, `user_integrations`, `user_sector_access`, `user_team_roles`.
5. Registra em `audit_logs` (quem inativou, herdeiro, contagens por tabela).

### 3. View canônica de usuários ativos
```
CREATE VIEW public.active_users AS
SELECT u.* FROM users u
LEFT JOIN hr_collaborators c ON c.user_id = u.id
WHERE COALESCE(c.status, 'active') <> 'inactive'
  AND COALESCE(u.role, '') <> 'inactive';
```
Com `security_invoker=on` + GRANTs. Todo seletor/menção passa a consumir essa view.

### 4. Job de auto-heal diário
Cron `pg_cron` 03:00 chamando `public.auto_heal_inactive_assignments()`:
- Varre leads/deals/clients/contracts/tasks/followups/zapp assignments com `responsible_user_id` de inativo.
- Reatribui via `get_default_reassignment_user`.
- Loga em `audit_logs` com `action = 'auto_heal_inactive'`.

### 5. Roda uma vez agora
Executa `auto_heal_inactive_assignments()` imediatamente para limpar o legado dos 6 inativos atuais.

## Frontend

### Hook central
`src/hooks/useActiveUsers.ts` — consulta a view `active_users`. Substitui as consultas diretas em `users` que alimentam:
- `mention-textarea` / `mention-input` (menções `@` na timeline)
- Seletores de responsável (leads, deals, clients, contracts, tasks, events, followups)
- Filtros por responsável (Kanban de vendas, listas)
- Rankings (Sales Ranking, TV View, dashboards de time)
- RoyZapp: seletor de atendente e transferências
- Financeiro: reconciliação (dono do lançamento)

Auditoria automatizada via `rg` para garantir que não sobre `.from("users")` em superfícies de escolha ativa. Superfícies históricas (timeline exibindo nome antigo, quem criou o registro) continuam mostrando o inativo — regra confirmada.

### UI de inativação em `/rh/collaborators`
Botão **Inativar** abre dialog que:
- Mostra o herdeiro default calculado por área (editável).
- Lista contagens ("47 leads, 12 deals, 3 clientes serão transferidos para Jonathan").
- Pede motivo.
- Chama `inactivate_collaborator` via RPC.
- Invalida caches (`users`, `active_users`, `leads`, `deals`, `clients`).

## Detalhes técnicos

- Todas as mudanças de schema (view, functions, trigger, GRANTs) em uma migração; o cron via `supabase--insert`.
- `active_users` recebe `GRANT SELECT` para `authenticated`; RLS herda do invocador.
- `inactivate_collaborator` só pode ser chamada por admin ou RH (checagem via `has_role`).
- Índices já existem em `responsible_user_id` das tabelas afetadas.
- Nenhuma alteração em `auth.users` — só `users` do schema `public`.

## Arquivos

**Novos**
- `supabase/migrations/<ts>_inactive_collaborator_flow.sql`
- `src/hooks/useActiveUsers.ts`
- `src/components/rh/InactivateCollaboratorDialog.tsx`

**Editados (superfícies de seletor/menção/ranking)**
- `src/components/ui/mention-textarea.tsx`, `mention-input.tsx`
- `src/hooks/useSectorUsers.tsx`
- `src/pages/rh/HRCollaborators.tsx` (novo botão)
- Seletores em Leads, Deals, Clients, Contracts, Tasks, Events, RoyZapp, Financeiro (troca de fonte para `active_users`)

## Fora de escopo

- Recontratação (reativar inativo) — se aparecer no futuro, invertemos via update simples de status.
- Reatribuir manualmente registro a registro — o herdeiro default resolve; usuário rebalanceia depois via UI existente.
