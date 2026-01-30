
# Plano: Corrigir Atualização do Nome do Grupo no Header

## Diagnóstico

### Problema Identificado
O header não atualiza o nome do grupo após edição porque há uma falha na sincronização do estado `selectedConversation`.

### Fluxo Atual

1. Usuário edita nome do grupo → `ZappEditGroupDialog.handleSave()` 
2. Banco de dados atualizado (`zapp_conversations.contact_name`)
3. `onSuccess()` chama `fetchData()`
4. `fetchData()` atualiza o array `assignments` com dados novos
5. **PROBLEMA**: O `useEffect` de sincronização (linha 148-170) **NÃO verifica `contact_name`**
6. `selectedConversation` permanece com dados antigos
7. Header mostra nome antigo (derivado de `selectedConversation`)
8. Sidebar mostra nome novo (derivado de `assignments`)

### Código do `useEffect` Problemático

```typescript
// Linha 148-170 - Só verifica client/lead, NÃO verifica contact_name
useEffect(() => {
  if (selectedConversation && assignments.length > 0) {
    const updatedAssignment = assignments.find(a => a.id === selectedConversation.id);
    if (updatedAssignment) {
      if (currentClientId !== updatedClientId || 
          currentLeadId !== updatedLeadId ||
          currentClientName !== updatedClientName ||
          currentLeadName !== updatedLeadName) {  // ← NÃO inclui contact_name!
        setSelectedConversation(updatedAssignment);
      }
    }
  }
}, [assignments]);
```

---

## Solução

### Adicionar verificação de `contact_name` no `useEffect` de sincronização

**Arquivo:** `src/pages/RoyZapp.tsx`

**Linhas 147-170** - Modificar para incluir `contact_name`:

```typescript
// Sync selectedConversation when assignments are updated (e.g., after linking to a lead or editing group name)
useEffect(() => {
  if (selectedConversation && assignments.length > 0) {
    const updatedAssignment = assignments.find(a => a.id === selectedConversation.id);
    if (updatedAssignment) {
      // Check if the linked client, lead, OR contact_name has changed
      const currentClientId = selectedConversation.zapp_conversation?.client_id;
      const updatedClientId = updatedAssignment.zapp_conversation?.client_id;
      const currentLeadId = selectedConversation.zapp_conversation?.lead_id;
      const updatedLeadId = updatedAssignment.zapp_conversation?.lead_id;
      const currentClientName = selectedConversation.zapp_conversation?.client?.full_name;
      const updatedClientName = updatedAssignment.zapp_conversation?.client?.full_name;
      const currentLeadName = selectedConversation.zapp_conversation?.lead?.full_name;
      const updatedLeadName = updatedAssignment.zapp_conversation?.lead?.full_name;
      // NEW: Track contact_name for groups
      const currentContactName = selectedConversation.zapp_conversation?.contact_name;
      const updatedContactName = updatedAssignment.zapp_conversation?.contact_name;
      
      if (currentClientId !== updatedClientId || 
          currentLeadId !== updatedLeadId ||
          currentClientName !== updatedClientName ||
          currentLeadName !== updatedLeadName ||
          currentContactName !== updatedContactName) {  // ← ADICIONAR ESTA CONDIÇÃO
        setSelectedConversation(updatedAssignment);
      }
    }
  }
}, [assignments]);
```

---

## Fluxo Corrigido

```
Usuário edita nome do grupo → handleSave()
                │
                ▼
    Atualiza banco de dados (contact_name)
                │
                ▼
    onSuccess() → fetchData()
                │
                ▼
    assignments atualizado com novo nome
                │
                ▼
    useEffect detecta: currentContactName !== updatedContactName ← NOVO!
                │
                ▼
    setSelectedConversation(updatedAssignment)
                │
                ▼
    selectedContactInfo recalculado via useMemo
                │
                ▼
    Header atualiza imediatamente ✓
```

---

## Resumo das Mudanças

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `src/pages/RoyZapp.tsx` | 147-170 | Adicionar verificação de `contact_name` no useEffect de sincronização |

---

## Por que isso resolve o problema

- O `useEffect` passará a detectar mudanças em `contact_name`
- Quando o nome do grupo for alterado, o `selectedConversation` será atualizado automaticamente
- O `selectedContactInfo` (useMemo) será recalculado com o novo `selectedConversation`
- O header exibirá o nome correto imediatamente
