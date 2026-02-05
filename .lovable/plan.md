
# Plano: Isolamento de Conversas por Usuário Responsável no ROY zAPP

## Resumo da Mudança

Implementar um sistema onde cada atendente só vê suas próprias conversas na aba "Minhas", enquanto Admins e Gestores mantêm visibilidade total para supervisão.

## Comportamento Atual vs. Novo

| Aspecto | Comportamento Atual | Novo Comportamento |
|---------|--------------------|--------------------|
| Aba "Minhas" | Admin vê todas as conversas atribuídas; outros veem apenas as suas | **Todos** só veem as conversas onde são o `agent_id` atribuído |
| Aba "Fila" | Mostra todas as conversas sem agente | Mantém igual (conversas aguardando atribuição) |
| Admin/Gestor | Vê tudo na aba "Minhas" | Vê tudo em **ambas** as abas (pode monitorar todas) |
| Puxar conversa já atribuída | Sem verificação | **Novo**: Exibe aviso: "Este contato já está em atendimento por {nome}" |

---

## Mudanças Detalhadas

### 1. Filtro da Aba "Minhas" (RoyZapp.tsx)

**Arquivo**: `src/pages/RoyZapp.tsx`
**Localização**: Linhas ~3688-3698 (filteredAssignments useMemo)

Atualmente:
```tsx
const matchesTab = (filterArchived || filterStatus === "closed" || skipTabFilterForGroups) ? true : (
  inboxTab === "mine" 
    ? (isAdmin || a.agent_id === currentAgent?.id) // Admins see all assigned
    : a.agent_id === null
);
```

Alteração proposta:
```tsx
// Verificar se é gestor (além de admin)
const isManager = currentUser?.team_role_name === "Gestor";
const hasFullVisibility = isAdmin || isManager;

const matchesTab = (filterArchived || filterStatus === "closed" || skipTabFilterForGroups) ? true : (
  inboxTab === "mine" 
    ? (hasFullVisibility ? true : a.agent_id === currentAgent?.id) // Apenas Admin/Gestor veem tudo
    : hasFullVisibility ? true : a.agent_id === null // Admin/Gestor também veem fila completa
);
```

**Resultado**: Atendentes comuns só veem conversas atribuídas a eles; Admin/Gestores veem todas.

---

### 2. Verificação ao Puxar Conversa Já Atribuída

**Arquivo**: `src/pages/RoyZapp.tsx`
**Funções afetadas**: `assignToMe` (~linha 1182), `pullFromQueue` (~linha 1219)

Adicionar verificação antes de atribuir:

```tsx
const assignToMe = async (assignmentId: string) => {
  if (!currentAgent) {
    toast.error("Você não está cadastrado como atendente");
    return;
  }

  // NOVA VERIFICAÇÃO: Checar se já está atribuída a outro agente
  const assignment = assignments.find(a => a.id === assignmentId);
  if (assignment?.agent_id && assignment.agent_id !== currentAgent.id) {
    const agentName = getAgentName(assignment.agent_id) || "outro atendente";
    toast.warning(`Este contato já está em atendimento por ${agentName}`);
    return;
  }

  // ... resto do código existente
};
```

Para `pullFromQueue`, já filtra apenas conversas sem agente, mas podemos adicionar verificação de segurança similar.

---

### 3. Verificação ao Criar Nova Conversa com Contato

**Arquivo**: `src/pages/RoyZapp.tsx`
**Função**: `createConversationWithContact` e `createConversationFromUrl`

Quando um usuário tenta iniciar conversa com um contato que já tem conversa ativa com outro agente:

```tsx
// Antes de criar ou abrir conversa:
if (activeAssignment && activeAssignment.agent_id && activeAssignment.agent_id !== currentAgent?.id) {
  const agentName = getAgentName(activeAssignment.agent_id) || "outro atendente";
  toast.warning(`Este contato já está em atendimento por ${agentName}`);
  // Não abre a conversa para atendentes comuns
  // Admin/Gestor pode continuar (apenas visualizar)
  if (!isAdmin && currentUser?.team_role_name !== "Gestor") {
    setCreatingConversation(false);
    return;
  }
}
```

---

### 4. Atualizar Contagens (Stats)

**Arquivo**: `src/pages/RoyZapp.tsx`
**Localização**: Stats useMemo (~linha 3740)

Manter as contagens corretas para cada tipo de usuário:

```tsx
const stats = useMemo(() => {
  const hasFullVisibility = isAdmin || currentUser?.team_role_name === "Gestor";
  
  // Para admin/gestor: contar todas as conversas atribuídas
  // Para atendente comum: contar apenas suas conversas
  const myConversations = hasFullVisibility 
    ? assignments.filter((a) => a.agent_id !== null && a.status !== "closed").length
    : assignments.filter((a) => a.agent_id === currentAgent?.id && a.status !== "closed").length;
  
  // ... resto das contagens
}, [agents, assignments, currentAgent?.id, isAdmin, currentUser?.team_role_name]);
```

---

### 5. Atualizar ZappConversationList.tsx

**Arquivo**: `src/components/royzapp/ZappConversationList.tsx`

Adicionar prop para controlar visibilidade e ajustar o filtro:

```tsx
interface ZappConversationListProps {
  // ... props existentes
  hasFullVisibility?: boolean; // Novo
}
```

Ajustar filteredAssignments:
```tsx
const matchesTab = isAdmin || hasFullVisibility
  ? true // Admin/Gestor vê tudo
  : (inboxTab === "mine" 
    ? a.agent_id === currentAgent?.id
    : a.agent_id === null);
```

---

## Fluxo de Visibilidade Final

```text
┌────────────────────────────────────────────────────────────────┐
│                    USUÁRIO ACESSA ROY zAPP                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─ É Admin ou Gestor? ─┐                                     │
│  │                      │                                      │
│  │  SIM                 │  NÃO                                │
│  │  ▼                   │  ▼                                   │
│  │  Vê TODAS as         │  Vê APENAS suas                     │
│  │  conversas em        │  conversas na                       │
│  │  todas as abas       │  aba "Minhas"                       │
│  │                      │                                      │
│  │  Pode abrir          │  Aba "Fila" mostra                  │
│  │  qualquer conversa   │  conversas SEM agente               │
│  │  (modo leitura)      │                                      │
│  │                      │  Ao tentar puxar                    │
│  │                      │  conversa atribuída:                │
│  │                      │  → Aviso: "Em atendimento           │
│  │                      │     por {nome}"                     │
│  └──────────────────────┴─────────────────────────────────────┘
```

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/pages/RoyZapp.tsx` | Lógica de filtro, verificações de atribuição, stats |
| `src/components/royzapp/ZappConversationList.tsx` | Prop hasFullVisibility e ajuste de filtro |

---

## Pontos de Atenção

1. **Sem alteração no banco de dados**: A mudança é puramente frontend, usando o campo `agent_id` já existente.

2. **Realtime continua funcionando**: Notificações de novas mensagens respeitarão a visibilidade (apenas o agente atribuído ou Admin/Gestor receberá).

3. **Gestores identificados por `team_role_name === "Gestor"`**: Consistente com o padrão existente no sistema.

4. **Grupos mantêm comportamento especial**: Grupos (is_group === true) continuam visíveis para todos no setor, pois são conversas coletivas.

---

## Testes Recomendados

1. Como atendente comum: verificar que só vê suas conversas na aba "Minhas"
2. Tentar puxar conversa já atribuída a outro atendente → deve aparecer aviso
3. Como Admin/Gestor: verificar visibilidade total de todas as conversas
4. Verificar que grupos continuam visíveis para todos
5. Testar transferência de conversa entre agentes
