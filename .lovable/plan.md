
## Situação atual

Auditei o backend e encontrei uma lacuna clara:

- **Frontend**: já bloqueia rotas/UI de Vendas via `useSectorAccess.hasVendasAccess` (ok).
- **Backend (RLS)**: as tabelas `deals`, `leads`, `pipelines`, `deal_stages`, `sales_meetings`, `sales_history`, `commission_deal_entries`, `sales_goals`, `sales_monthly_goals` só filtram por `account_id`. Ou seja, **qualquer usuário logado da conta consegue ler dados do Comercial via API**, mesmo sem acesso ao setor "vendas". As páginas do dashboard só escondem — não protegem.
- Não existe função `has_sector_access` no banco. Setor não é coluna em nenhuma dessas tabelas — o vínculo é conceitual (todas essas tabelas são do domínio Comercial).

## O que vou fazer

### 1. Função `SECURITY DEFINER` no banco

Criar `public.user_has_sector_access(_user_auth_id uuid, _sector_id text)` que retorna `true` se:
- usuário for `role='admin'` ou `is_also_admin=true` em `public.users`, ou
- for super admin (`public.super_admins`), ou
- tiver linha ativa em `user_sector_access` para o setor.

Sem recursão (lê tabelas diferentes das que serão protegidas).

### 2. Reforço de RLS nas tabelas do domínio Comercial

Adicionar à cláusula `USING`/`WITH CHECK` de SELECT/INSERT/UPDATE/DELETE:
`AND public.user_has_sector_access(auth.uid(), 'vendas')`

Tabelas afetadas:
- `deals`, `deal_stages`, `deal_activities`, `deal_field_values`, `deal_loss_reasons`, `deal_loss_sub_reasons`, `deal_operation_briefings`
- `leads`, `lead_field_values`, `lead_timeline`, `lead_duplicate_attempts`
- `pipelines`, `pipeline_filters`
- `sales_meetings`, `sales_history`, `sales_records`
- `sales_goals`, `sales_monthly_goals`, `sales_product_goals`, `sales_goal_metrics`, `sales_quotas`, `sales_user_ote`
- `commission_deal_entries`, `commission_periods`, `commission_plans`, `commission_tiers`, `commission_triggers`, `commission_sales_levels`, `commission_approval_history`
- `sales_incentive_plans`, `sales_incentive_tiers`, `sales_incentive_product_rates`, `sales_spiffs`, `spiff_spins`, `spiff_spin_requests`
- `sales_call_analyses`, `sales_chat_sessions`, `sales_chat_messages`, `sales_dashboard_pinned_kpis`, `sales_team_careers`
- `renewal_outcomes` (fluxo Renovações usa acesso próprio; será excluído se conflitar)

Não afeta:
- `clients`, `client_contracts`, `financial_*` (compartilhados entre CS e Financeiro; têm regras próprias).
- `zapp_*` (já isolado por setor).
- Webhooks/edge functions que rodam como `service_role` (bypassa RLS por design).

### 3. Edge functions sensíveis

Auditar e reforçar validação de setor nas functions que expõem dados de vendas para usuários finais (não webhooks):
- `create-lead-core`, `sales-team-*`, `pipeline-*` — checar se validam identidade e adicionar `user_has_sector_access(auth.uid(), 'vendas')` quando escrevem/leem em nome do usuário.
- Webhooks externos (`uazapi-webhook`, `typeform-*`, integrações) continuam com `service_role` — sem impacto.

### 4. Verificação

Após aprovar a migração:
1. Rodar linter Supabase.
2. Testar como um usuário SEM `vendas` (ex.: Arthur Mudri) — leitura de `deals` deve retornar 0 linhas.
3. Testar como Jonathan (com `vendas`) — leitura normal.
4. Testar como admin — leitura total.

## Detalhes técnicos

```sql
CREATE OR REPLACE FUNCTION public.user_has_sector_access(_auth_user_id uuid, _sector_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = _auth_user_id
      AND (u.role = 'admin' OR u.is_also_admin = true)
  ) OR EXISTS (
    SELECT 1 FROM public.super_admins sa
    JOIN public.users u ON u.id = sa.user_id
    WHERE u.auth_user_id = _auth_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_sector_access usa
    JOIN public.users u ON u.id = usa.user_id
    WHERE u.auth_user_id = _auth_user_id
      AND usa.sector_id = _sector_id
      AND usa.is_active = true
  );
$$;
```

Cada política atualizada vira algo como:
```sql
USING (
  account_id = get_user_account_id()
  AND public.user_has_sector_access(auth.uid(), 'vendas')
)
```

## Riscos

- **Quebra de listagens** para usuários sem `vendas` que hoje acessam páginas por engano — é justamente o objetivo. Verifico que apenas os 7 autorizados + admins mantenham acesso antes de finalizar.
- **Webhooks**: rodam via `service_role`, não são afetados.
- **Renovações**: usa lista `RENEWALS_FULL_ACCESS_USER_IDS` no frontend; adiciono exceção via `hr_allow_renewals` se conflitar com quem não tem `vendas`.

Confirma que posso avançar com a migração?
