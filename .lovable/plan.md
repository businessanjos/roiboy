
# Plano: Permitir Conversas Individuais Cross-Sector por Instância

## Problema Identificado

O erro "Conversa individual pertence a outro setor" aparece porque o useEffect de validação (linhas 228-262) bloqueia a seleção de conversas que não estão na lista de `assignments` do departamento atual. Isso conflita com a arquitetura "Uma Conversa por Instância" que deveria permitir cada número WhatsApp ter sua própria conversa independente com o mesmo contato.

### Fluxo Atual (Problemático)

```text
┌─────────────────────────────────────────────────────────────────┐
│  1. Usuário busca "Lucelia Moraes" na instância B               │
│  2. createConversationWithContact() encontra conversa na        │
│     instância A (outro setor) via fallback                      │
│  3. useEffect detecta que NÃO está na lista de assignments      │
│  4. Limpa seleção com "Conversa individual pertence a outro     │
│     setor"                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo Correto (Desejado)

```text
┌─────────────────────────────────────────────────────────────────┐
│  1. Usuário busca "Lucelia Moraes" na instância B               │
│  2. createConversationWithContact() busca por integration_id    │
│  3. Se não existe conversa para ESTA instância, CRIA uma nova   │
│  4. Assignment é criado no departamento atual                   │
│  5. Conversa abre normalmente (cada instância = conversa única) │
└─────────────────────────────────────────────────────────────────┘
```

## Causa Raiz

Há dois problemas interligados:

### Problema 1: useEffect de Validação Muito Restritivo
O useEffect (linhas 228-262) verifica se a conversa existe nos `assignments` do setor atual. Se não existir, bloqueia. Mas para o modelo multi-instância, cada instância pode criar sua própria conversa - não deveria bloquear.

### Problema 2: Busca de Conversa com Fallback Cross-Integration
A função `createConversationWithContact` (linhas 3256-3291) primeiro busca por `integration_id`, mas tem fallbacks que podem encontrar conversas de outras instâncias. Quando isso acontece, ela tenta usar a conversa existente em vez de criar uma nova para a instância atual.

## Solução

### Parte 1: Remover Validação de Setor para Conversas Individuais

O useEffect de validação de setor deve ser removido ou modificado para verificar se a conversa pertence à **instância** atual, não ao setor. Como cada instância tem seu próprio índice único `(account_id, phone_e164, integration_id)`, a própria busca/criação já garante isolamento.

**Arquivo:** `src/pages/RoyZapp.tsx`

**Modificação:** Alterar o useEffect para verificar `integration_id` em vez de `department_id` e permitir que conversas individuais sejam abertas se pertencem à instância selecionada.

**De (linhas 228-262):**
```tsx
useEffect(() => {
  if (!selectedConversation || !selectedSectorId || !currentUser?.account_id) return;
  if (!currentSectorDepartmentId) return;
  
  const existsInCurrentSector = assignments.some(
    a => a.id === selectedConversation.id
  );
  
  if (existsInCurrentSector) return;
  
  const isGroup = selectedConversation.zapp_conversation?.is_group;
  
  if (isGroup) return;
  
  // INDIVIDUAL CONTACTS: Clear selection
  setSelectedConversation(null);
  toast.info("Conversa individual pertence a outro setor");
}, [...]);
```

**Para:**
```tsx
useEffect(() => {
  if (!selectedConversation || !currentUser?.account_id) return;
  
  // Check if conversation exists in current assignments list
  const existsInCurrentList = assignments.some(
    a => a.id === selectedConversation.id
  );
  
  if (existsInCurrentList) return; // Already in list, nothing to do
  
  // For groups, don't auto-clear (multi-sector support)
  const isGroup = selectedConversation.zapp_conversation?.is_group;
  if (isGroup) return;
  
  // For individual contacts, check if it belongs to the CURRENT INTEGRATION
  // Each instance can have its own conversation with the same contact
  const conversationIntegrationId = selectedConversation.zapp_conversation?.integration_id;
  
  if (conversationIntegrationId === selectedIntegrationId) {
    // Same integration - this is our conversation, add to local list
    console.log("[RoyZapp] Individual conversation from current integration - allowing");
    return;
  }
  
  // Different integration - this shouldn't happen normally since we filter by integration
  // But if it does, just log it without blocking (the correct conversation will be created)
  console.log("[RoyZapp] Individual conversation from different integration", {
    selectedId: selectedConversation.id,
    conversationIntegrationId,
    selectedIntegrationId,
  });
  // Don't clear selection - let createConversationWithContact handle it
}, [selectedConversation, assignments, selectedIntegrationId, currentUser?.account_id]);
```

### Parte 2: Garantir Criação de Nova Conversa por Instância

A função `createConversationWithContact` precisa garantir que cria uma nova conversa quando não existe uma para a instância atual, mesmo que existam conversas para outras instâncias.

**Arquivo:** `src/pages/RoyZapp.tsx`

**Modificação:** Remover fallbacks que buscam conversas de outras instâncias e garantir que sempre cria uma nova se não existir para a instância atual.

A lógica atual na linha 3256-3264 já faz isso corretamente:
```tsx
// PRIORIZAR busca por telefone + integration_id (cada instância tem sua própria conversa)
let convByPhone = await supabase
  .from("zapp_conversations")
  .select("id, lead_id, client_id, integration_id")
  .eq("account_id", currentUser.account_id)
  .eq("phone_e164", normalizedPhone)
  .eq("integration_id", selectedIntegrationId)  // Busca APENAS na instância atual
  .eq("is_group", false)
  .maybeSingle();
```

O problema está no fallback (linhas 3266-3291) que migra conversas legadas. Vamos manter esse fallback apenas para conversas SEM integration_id (legadas), não para conversas de outras instâncias.

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | 1. Alterar useEffect de validação para verificar `integration_id` em vez de bloquear por setor |
| `src/pages/RoyZapp.tsx` | 2. Garantir que a criação de conversa não tenta reutilizar conversas de outras instâncias |

## Comportamento Esperado Após Correção

| Cenário | Comportamento |
|---------|---------------|
| Lucelia tem conversa com instância A | Instância B pode criar nova conversa separada |
| Abrir contato na instância B | Busca apenas por `integration_id` da instância B |
| Contato não tem conversa na instância atual | Cria nova conversa vinculada à instância atual |
| Grupos multi-setor | Mantém comportamento atual (multi-setor permitido) |

## Detalhes Técnicos

O índice único no banco de dados `(account_id, phone_e164, integration_id)` já suporta múltiplas conversas com o mesmo contato em instâncias diferentes. A correção no frontend apenas remove a validação incorreta que estava bloqueando esse uso legítimo.
