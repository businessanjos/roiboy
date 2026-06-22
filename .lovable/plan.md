## Diagnóstico

A Andreia tem hoje no banco 3 roles via `user_team_roles`: **Admin**, **Consultor**, **Supervisor CX**. Tanto a role *Admin* (com `team.view`/`team.edit`) quanto a *Supervisor CX* (com `team.edit_cx`) deveriam liberar o grupo "Gestão → Equipe" no sidebar de Configurações. Os dados estão corretos, RLS deixa ler `role_permissions`, e `SettingsSidebarNav` confere `isAdmin || hasPermission(TEAM_EDIT_CX)`.

A causa da Equipe não aparecer é cache da sessão dela no navegador:

- `useCurrentUser` carrega `team_role_ids` uma vez no login e mantém no `useState`.
- `usePermissions` deriva tudo a partir desse `currentUser` — se a lista de roles mudou no banco *depois* dela já estar logada, ela continua com a lista antiga até dar logout/login.
- O `useReloadPermissions` existe, mas só invalida React Query e chama `refetchPermissions()`. Ele **não** chama `refetchUser()` do `useCurrentUser` (que é `useState`, não query), então `team_role_ids` nunca atualiza.

## O que vou fazer

1. **Corrigir `useReloadPermissions`** para também chamar `refetchUser()` do `useCurrentUser` antes do `refetchPermissions()`, garantindo que a lista de roles seja recarregada do banco.
2. **Disparar reload automático quando um admin altera roles**: no `TeamManager`, após atribuir/remover roles de um usuário, fazer broadcast via Supabase Realtime (canal `user-roles-${userId}`) ou um `postgres_changes` em `user_team_roles` filtrado por `user_id=eq.<self>`. No `CurrentUserProvider`, escutar esse canal e chamar `fetchUser()` quando houver mudança nas próprias roles — assim a Andreia recebe a role nova em segundos, sem refresh.
3. **Ação imediata para a Andreia**: pedir que ela faça hard refresh (Ctrl+Shift+R) ou logout/login uma vez para destravar a sessão atual. Depois do item 2, isso não será mais necessário em casos futuros.

## Arquivos afetados

- `src/hooks/useReloadPermissions.tsx` — encadear `refetchUser` antes de `refetchPermissions`.
- `src/hooks/useCurrentUser.tsx` — adicionar subscription Realtime em `user_team_roles` filtrada por `user_id=eq.${currentUser.id}` que dispara `fetchUser()`.
- (Opcional) `src/components/settings/TeamManager.tsx` — sem mudança necessária se usarmos `postgres_changes`, já que o INSERT/DELETE em `user_team_roles` propaga sozinho.

## Como validar

- Logar como Andreia, abrir `/settings`, confirmar que aparece o grupo **Gestão → Equipe**.
- Como admin, remover a role *Supervisor CX* dela em outra aba e ver o item sumir em poucos segundos sem refresh.
- Reatribuir e ver o item voltar.
