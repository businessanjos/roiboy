# Acesso global por atendente (RoyZapp)

Adicionar um toggle por atendente na lista da Equipe que concede ao usuário a **mesma visibilidade que Admin/Gestor** dentro do RoyZapp — ver e puxar conversas atribuídas a qualquer outro atendente. Pode ser ligado/desligado a qualquer momento, e somente Admin/Gestor pode alterar.

## Mudanças

### Banco
- Adicionar coluna `has_global_access boolean NOT NULL DEFAULT false` em `zapp_agents`.
- Atualizar `release_zapp_assignments_for_user` (sem mudança funcional — apenas garantir que a coluna existe).

### Backend / lógica de visibilidade
- Em `useZappData.tsx`, expandir o cálculo de `hasGlobalVisibility` para também ser `true` quando o `zapp_agent` do usuário atual tiver `has_global_access = true`.
- Como `currentAgent` já é carregado em `useZappDialogs`, basta ler `dialogs.currentAgent?.has_global_access`.

### UI — `ZappTeamList.tsx`
- Ao lado do switch de online, adicionar um segundo switch pequeno rotulado **"Acesso global"** (com tooltip: "Vê e pode puxar conversas de qualquer atendente").
- Visível para todos, mas **somente habilitado** quando o usuário logado for Admin/Gestor (`hasGlobalVisibility === true`). Para os demais, fica `disabled` e apenas indica o estado atual.
- Indicador visual quando ativo: pequeno badge "Global" na linha do atendente.

### Handler
- Em `RoyZapp.tsx`, adicionar `onToggleAgentGlobalAccess(agent)` análogo a `onToggleAgentOnline`, que faz `update zapp_agents set has_global_access = !current where id = agent.id` e recarrega via `fetchData`.
- Passar a prop nova ao `ZappTeamList`.

### Tipos
- Estender `Agent` em `src/components/royzapp/types.ts` com `has_global_access: boolean`.
- Tipos do Supabase regeneram após a migration.

## Fora do escopo
- Não cria nova role nem mexe em RBAC global — é uma flag local do RoyZapp.
- Não altera o trigger de bloqueio de atribuição a inativos.
- Sem mudanças no `ZappAgentDialog` (toggle vive só na lista, conforme escolhido).
