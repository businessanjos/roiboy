# Corrigir visibilidade global no RoyZapp para Admin/Gestor

## Problema
Andréia tem `role = "gestor"` (DB), `is_also_admin = false` e team roles `["Admin", "Consultor"]`. No filtro de abas do RoyZapp, a condição que libera "ver tudo" é a prop `isAdmin` vinda de `usePermissions`, que só considera `role in ("admin","super_admin")` ou `is_also_admin`. Resultado: na aba "Minhas", ela só vê conversas onde `agent_id = currentAgent.id`, mesmo sendo Admin pelo papel de time.

Existe inclusive um `hasGlobalVisibility` já calculado corretamente em `useZappData.tsx` (linhas 65-73) que reconhece `team_role_names.includes("Admin")`, mas ele nunca chega ao `ZappConversationList`.

## Solução
Unificar a checagem de visibilidade global usando o `hasGlobalVisibility` já existente e propagá-lo até o filtro de abas.

### Mudanças
1. **`src/hooks/useZappData.tsx`** — expor `hasGlobalVisibility` no retorno do hook (hoje fica interno).
2. **`src/pages/RoyZapp.tsx`** — consumir `hasGlobalVisibility` de `useZappData` e usar `isAdmin || hasGlobalVisibility` como prop `isAdmin` passada ao `ZappConversationList` (linha ~1148). Mantém compat: super_admin / admin / is_also_admin continuam funcionando, e agora team_role "Admin"/"Gestor" também.
3. **`src/hooks/useZappConversations.ts`** — remover `hasGlobalVisibility` da dependency array do `useMemo` em filteredAssignments (dead var), para evitar confusão futura. Sem mudança de comportamento.

Não mexer em `usePermissions.isAdmin` global (impacto além do RoyZapp) — o ajuste fica escopado ao RoyZapp, que é onde o usuário relatou o problema e onde a semântica de "ver tudo" é claramente desejada para Admin/Gestor.

### Validação
- Após o fix, Andréia (team_role Admin) verá todas as conversas independente da aba.
- Usuários sem papel Admin/Gestor continuam restritos a `agent_id = currentAgent.id` na aba "Minhas".
- Sem migration; apenas frontend.
