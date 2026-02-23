
## Corrigir navegacao limitada para usuarios CX (Jose da Paixao)

### Problema

O usuario Jose da Paixao (papel CX, setor Operacoes) ve apenas 3 abas na sidebar (Tarefas, ROY Chat, Notificacoes) em vez de todas as abas do setor Operacoes. Deveria ver Dashboard, Clientes, Contratos, Eventos, Formularios, etc.

### Causa raiz

O hook `useCurrentUser` busca o nome do papel via JOIN do Supabase (`team_role:team_roles(name)`). Esse JOIN pode retornar `null` silenciosamente por questoes de cache ou resolucao de FK do PostgREST. Quando `team_role_name` e `undefined`:

1. `hasFullSectorAccess()` retorna `false` (pois verifica `teamRoleName === "CX"`)
2. O fallback por permissoes individuais tambem pode falhar se a cadeia de RLS (`role_permissions` -> `team_roles` -> `get_user_account_id()`) tiver problemas de timing
3. Resultado: so aparecem itens SEM requisito de permissao

### Solucao

#### 1. `src/hooks/useCurrentUser.tsx` - Fallback robusto para team_role_name

Adicionar `team_role_id` ao SELECT e, se o JOIN falhar (team_role_name vazio mas team_role_id presente), fazer uma query separada para buscar o nome do papel. Isso garante que `team_role_name` esteja sempre disponivel.

```text
Fluxo atual (fragil):
  SELECT ... team_role:team_roles(name) → se JOIN falha, team_role_name = undefined

Fluxo corrigido (robusto):
  SELECT ... team_role_id, team_role:team_roles(name)
  → se JOIN retorna null E team_role_id existe:
    → SELECT name FROM team_roles WHERE id = team_role_id
    → team_role_name = resultado da query separada
```

#### 2. `src/hooks/usePermissions.tsx` - Fallback de permissoes mais seguro

Se a query de `role_permissions` retornar vazia ou com erro, e o usuario tiver um `team_role_id` valido, aplicar as permissoes padrao em vez de um array vazio. Isso evita que o usuario fique completamente sem permissoes.

#### 3. `src/components/layout/Sidebar.tsx` - Checagem adicional de seguranca

Adicionar o papel do sistema `"mentor"` como bypass adicional em `hasFullSectorAccess()` para o setor `operacoes`, garantindo que mentores com papel CX sempre vejam todas as abas do setor, mesmo que `team_role_name` falhe ao carregar.

### Arquivos alterados

- `src/hooks/useCurrentUser.tsx`: Adicionar `team_role_id` ao select e fallback query
- `src/hooks/usePermissions.tsx`: Melhorar fallback quando permissoes nao carregam
- `src/components/layout/Sidebar.tsx`: Adicionar verificacao de `role === "mentor"` como bypass para operacoes

### Resultado

- Jose da Paixao e outros usuarios CX verao todas as abas do setor Operacoes
- O sistema fica resiliente contra falhas silenciosas do JOIN do PostgREST
- Nenhuma mudanca de banco de dados necessaria
