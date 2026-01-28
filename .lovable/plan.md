
# Plano: Separar Lógica de Grupos e Contatos no ROY zAPP

## Resumo

Atualmente, quando você clica para iniciar uma conversa com um grupo, ele é criado com `agent_id: null` e `status: "triage"` (igual a contatos). Por isso o grupo vai para a **Fila** e não aparece na aba **"Minhas"**.

A solução é criar uma lógica específica para grupos: ao iniciar conversa com um grupo, ele será **imediatamente atribuído a você** e aparecerá na aba "Minhas", permitindo que você decida se quer fixá-lo ou não.

## Diferença Entre Contatos e Grupos

| Aspecto | Contatos | Grupos (Novo) |
|---------|----------|---------------|
| Ao iniciar | Vai para Fila (`agent_id: null`, `status: triage`) | Atribuído ao agente (`agent_id: currentAgent.id`, `status: active`) |
| Onde aparece | Aba "Fila" | Aba "Minhas" |
| Para atender | Precisa "puxar" da fila | Já está atribuído |
| Ao sair | Some da lista se não fixado | Some da lista se não fixado |

## Mudanças Técnicas

### Arquivo: `src/pages/RoyZapp.tsx`

#### Mudança 1: Criar novo grupo (linhas 2862-2872)

Alterar de `agent_id: null` e `status: "triage"` para `agent_id: currentAgent.id` e `status: "active"`:

```typescript
// ANTES
.insert({
  account_id: currentUser.account_id,
  zapp_conversation_id: zappConvId,
  agent_id: null,           // ❌ Vai para fila
  status: "triage",         // ❌ Status de triagem
  department_id: currentSectorDepartmentId,
})

// DEPOIS  
.insert({
  account_id: currentUser.account_id,
  zapp_conversation_id: zappConvId,
  agent_id: currentAgent.id,  // ✅ Atribuído ao agente atual
  status: "active",           // ✅ Status ativo
  department_id: currentSectorDepartmentId,
  assigned_at: new Date().toISOString(),  // ✅ Data de atribuição
})
```

#### Mudança 2: Reabrir grupo fechado (linha 2829)

Alterar de `agent_id: null` e `status: "triage"` para atribuir ao agente atual:

```typescript
// ANTES
.update({ 
  status: "triage", 
  agent_id: null, 
  updated_at: new Date().toISOString() 
})

// DEPOIS
.update({ 
  status: "active",           // ✅ Status ativo
  agent_id: currentAgent.id,  // ✅ Atribuído ao agente atual
  assigned_at: new Date().toISOString(),
  updated_at: new Date().toISOString() 
})
```

#### Mudança 3: Ajustar navegação para aba "Minhas"

Após criar/reabrir grupo, mudar para aba "Minhas" (não "Fila"):

```typescript
// ANTES
setFilterConversationType("group");

// DEPOIS  
setInboxTab("mine");           // ✅ Vai para aba "Minhas"
setFilterConversationType("group");  // ✅ Mostra grupos
```

#### Mudança 4: Atualizar o assignment local com o agent correto

Quando adicionamos à lista local, garantir que o agent está presente:

```typescript
if (newAssignment) {
  // Enrich with current agent data for immediate display
  const enrichedAssignment = {
    ...newAssignment,
    agent: { ...currentAgent }
  };
  setSelectedConversation(enrichedAssignment);
  setAssignments(prev => [enrichedAssignment, ...prev]);
}
```

## Fluxo Corrigido

```text
[Usuário clica em grupo no "Nova Conversa"]
                 ↓
[Sistema cria assignment com:]
  • agent_id = currentAgent.id
  • status = "active"
  • assigned_at = now()
                 ↓
[Sistema adiciona à lista local]
                 ↓
[Sistema muda para aba "Minhas" + filtro "grupos"]
                 ↓
[GRUPO APARECE NA LISTA!] ✅
                 ↓
[Usuário pode:]
  • Fixar grupo (📌) → Permanece visível
  • Não fixar → Desaparece ao fechar
```

## Resultado Esperado

1. Ao clicar em um grupo no "Nova Conversa", ele aparece **imediatamente** na aba "Minhas"
2. O grupo fica disponível para ser fixado (menu 3 pontinhos → "Fixar")
3. Se o usuário não fixar e fechar a conversa, o grupo some da lista (comportamento normal)
4. Se o usuário fixar, o grupo permanece visível mesmo após fechamento
5. Contatos continuam funcionando como antes (indo para a Fila)

## Impacto

- Nenhuma mudança no banco de dados
- Apenas ajustes de lógica no frontend
- Separação clara entre fluxo de contatos e grupos
- Melhora significativa na usabilidade
