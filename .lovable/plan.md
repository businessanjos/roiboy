# Plano: Papel "Supervisor CX"

## Objetivo
Criar um novo papel `Supervisor CX` que possa gerenciar a equipe de Customer Success (incluindo cadastrar novos membros), ter acesso completo à área de Operações e ao ROY zAPP (inclusive conectar instâncias), mas **sem** acesso a Financeiro, Gestão Tech, RH, Vendas, Marketing, etc.

## Acessos concedidos
- **Setores ativos por padrão**: `operacoes`, `royzapp`
- **Permissões granulares**:
  - `clients.view`, `clients.edit` (operação completa)
  - `reports.view` (dashboard CX)
  - `products.view`, `forms.view`
  - `royzapp.access` + acesso a `?view=settings`, `?view=whatsapp-admin`, `?view=team`, `?view=departments` (conectar e administrar zAPP)
  - `team.view` + nova permissão `team.edit_cx` (ver lista da equipe e cadastrar/editar somente membros do escopo CX)
  - `settings.view` (acesso a `/settings?tab=team` filtrado)
- **Bloqueado**: Financeiro, Gestão Tech, RH, Vendas, Marketing, Eventos, Configurações sensíveis (integrations, api-key, tech-tokens, sectors admin).

## Mudanças

### 1. Banco (migration)
- Criar `team_role` "Supervisor CX" (area=CX, job=Supervisor, seniority=Pleno) — inserido via insert tool, não migration.
- Adicionar a constante de permissão `team.edit_cx` em `role_permissions` para esse papel.
- Conceder em `role_permissions` as permissões listadas acima para o `team_role_id` recém-criado.

### 2. Frontend — permissões
- `src/lib/access/permissions.ts`: adicionar `TEAM_EDIT_CX = "team.edit_cx"`.
- `src/hooks/usePermissions.tsx`: incluir `TEAM_EDIT_CX` no set de `MANAGEMENT_PERMISSIONS` (impedir que venha implícito via sector access).
- `src/lib/access/routeAccess.ts`: idem.

### 3. Settings → aba Team
- `src/pages/Settings.tsx`: trocar o gate `isAdmin` da aba `team` por `isAdmin || hasPermission(TEAM_EDIT_CX)`.
- `src/components/settings/TeamManager.tsx`: quando o usuário tiver apenas `TEAM_EDIT_CX` (e não for admin):
  - filtrar a lista para mostrar somente membros cujo `team_role` esteja na área CX;
  - ao criar/editar, restringir o seletor de papéis àqueles da área CX;
  - esconder o toggle `is_also_admin`.

### 4. Edge function `create-team-user`
- Substituir o gate "apenas admin" por: admin **ou** usuário com permissão `team.edit_cx`.
- Quando for `team.edit_cx` (não admin):
  - exigir que `team_role_ids` recebidos pertençam à área CX (validar via `team_roles.area`);
  - rejeitar `is_also_admin = true`;
  - manter mesma `account_id` do solicitante.
- Verificação de permissão consulta `role_permissions` via service role.

### 5. Sidebar / navegação
- Garantir que `useSectorAccess` libere `operacoes` + `royzapp` para o usuário com base no `user_sector_access` (cadastro padrão ao criar o usuário). Nada novo no código aqui, só dado.

## Detalhes técnicos

- O `usePermissions` já une perms de role + sector. Como `team.edit_cx` é management-like, deve ser concedido **somente** via `role_permissions` (não via sector), por isso entra na lista `MANAGEMENT_PERMISSIONS`.
- A filtragem por área CX no TeamManager usa `team_roles.area = 'CX'` (taxonomia já existente).
- O `create-team-user` valida a área dos papéis solicitados com um `select id, area from team_roles where id = any($1)` e bloqueia se algum não for CX.
- Nenhum impacto no allowlist `RH_ALLOWED_EMAILS` (CX é independente).

## Como atribuir depois
Admin abre Configurações → Equipe → edita o usuário desejado e marca o papel "Supervisor CX". O sistema concede automaticamente as permissões e os setores correspondentes.
