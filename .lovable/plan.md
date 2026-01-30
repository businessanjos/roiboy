
# Plano: Corrigir Grupos Não Aparecendo na Barra Lateral do RoyZapp

## Diagnóstico

### Causa Raiz Identificada
Ao investigar a fundo, identifiquei **dois problemas principais**:

### Problema 1: Usuários Admin/Mentor Sem Cadastro de Agente
O usuário João Ferrari (role: `mentor`, `is_also_admin: true`) **não está cadastrado como agente (`zapp_agents`) em nenhum departamento**.

Quando ele tenta abrir um grupo via "Nova Conversa", a função `createConversationWithContact` (linha 2930) retorna imediatamente:

```typescript
if (!currentUser?.account_id || !currentAgent) return;
//                              ^^^^^^^^^ NULL para admins não cadastrados como agente
```

Resultado: A função silenciosamente não faz nada e o grupo não aparece.

### Problema 2: Verificação de Agente Bloqueando Criação de Assignments
A lógica atual exige que o usuário seja um agente para:
- Abrir grupos via "Nova Conversa"
- Criar novos assignments

Porém, administradores/gestores podem precisar acessar conversas sem necessariamente serem atendentes.

---

## Solução Proposta

### Mudança 1: Permitir que Admins Abram Grupos Mesmo Sem Ser Agente

Modificar a lógica de `createConversationWithContact` para:

1. **Para GRUPOS**: Não exigir que o usuário seja agente
2. Criar o assignment com `agent_id: null` se não houver agente
3. Atribuir ao agente atual apenas se ele existir

### Mudança 2: Feedback Visual Quando Usuário Não é Agente

Ao invés de silenciosamente ignorar, mostrar toast explicativo quando não houver agente.

---

## Alterações Técnicas

### Arquivo: `src/pages/RoyZapp.tsx`

#### Linha 2929-2931 - Modificar verificação inicial:

**De:**
```typescript
const createConversationWithContact = async (contact: any) => {
  if (!currentUser?.account_id || !currentAgent) return;
```

**Para:**
```typescript
const createConversationWithContact = async (contact: any) => {
  if (!currentUser?.account_id) return;
  
  // For groups, allow opening even without being an agent
  const isGroupContact = contact.type === 'group';
  
  if (!isGroupContact && !currentAgent) {
    toast.error("Você precisa estar cadastrado como atendente para iniciar conversas individuais");
    return;
  }
```

#### Linhas 3010-3022 - Ajustar criação de assignment para grupos:

**De:**
```typescript
const { data: newAssignment } = await supabase
  .from("zapp_conversation_assignments")
  .insert({
    account_id: currentUser.account_id,
    zapp_conversation_id: zappConvId,
    agent_id: currentAgent?.id || null,  // Pode ser null
    status: "active",
    department_id: currentSectorDepartmentId,
    assigned_at: new Date().toISOString(),
  })
```

**Para (sem alteração funcional, apenas garantir que currentAgent pode ser null):**
```typescript
const { data: newAssignment } = await supabase
  .from("zapp_conversation_assignments")
  .insert({
    account_id: currentUser.account_id,
    zapp_conversation_id: zappConvId,
    agent_id: currentAgent?.id || null,  // OK - admins podem abrir sem agente
    status: currentAgent ? "active" : "triage",  // Se não for agente, vai para triagem
    department_id: currentSectorDepartmentId,
    assigned_at: currentAgent ? new Date().toISOString() : null,
  })
```

#### Linhas 2963-3007 - Mesma lógica para reabrir grupos fechados:

Garantir que grupos podem ser reabertos por admins sem precisar ser agente, ajustando `agent_id` e `status` apropriadamente.

#### Linha 3030-3032 - Ajustar enriquecimento do assignment:

```typescript
const enrichedAssignment = {
  ...newAssignment,
  agent: currentAgent ? { ...currentAgent } : null  // OK se for null
};
```

#### Linha 3037-3038 - Ajustar navegação para aba correta:

```typescript
// Se tem agente, vai para "Minhas"; senão, vai para "Fila"
setInboxTab(currentAgent ? "mine" : "queue");
setFilterConversationType("group");
```

---

## Fluxo Corrigido

```text
Admin/Mentor clica em "Nova Conversa"
              │
              ▼
    Pesquisa e seleciona grupo
              │
              ▼
    createConversationWithContact()
              │
              ├── É grupo? ─── Sim ──► Continua mesmo sem currentAgent
              │
              └── É individual? ──► Precisa ser agente (erro se não for)
              │
              ▼
    Cria assignment no setor atual:
    - agent_id: currentAgent?.id (null se não for agente)
    - status: currentAgent ? "active" : "triage"
    - department_id: currentSectorDepartmentId
              │
              ▼
    Adiciona imediatamente ao setAssignments
              │
              ▼
    Navega para aba correta:
    - "Minhas" se tiver agente
    - "Fila" se não tiver agente
              │
              ▼
    GRUPO APARECE NA BARRA LATERAL ✓
```

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/pages/RoyZapp.tsx` | Permitir grupos sem `currentAgent`; ajustar status para "triage" quando não há agente; ajustar navegação de aba |

## Benefícios

- Admins/mentores podem acessar grupos sem precisar estar cadastrados como agentes
- Feedback claro quando usuário não pode realizar ação
- Mantém segurança: conversas individuais ainda requerem agente
- Grupos ficam visíveis na barra lateral imediatamente após abertura
