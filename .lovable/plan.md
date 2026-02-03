
# Plano: Limpar Conversa Selecionada ao Finalizar via Dropdown

## Problema Identificado

Quando o usuário muda o status de uma conversa para **"Finalizado"** através do dropdown no header, a conversa:

| O que acontece | Esperado | Atual |
|----------------|----------|-------|
| Status atualizado no banco | ✅ Sim | ✅ Sim |
| Conversa removida da lista lateral | ✅ Sim | ✅ Sim |
| **Conversa fechada no painel principal** | ✅ Sim | ❌ **NÃO** |

A conversa permanece aberta porque `setSelectedConversation(null)` **nunca é chamado** quando o status muda para `closed` via dropdown.

## Comparação com o Dialog de Finalização

O botão "Finalizar" (verde com CheckCircle) usa o `ZappCloseTicketDialog`, que **corretamente** limpa a seleção no callback:

```typescript
// ZappCloseTicketDialog onSuccess (linha 4360-4364)
onSuccess={() => {
  setCloseTicketDialogOpen(false);
  setSelectedConversation(null); // ✅ Limpa corretamente
  fetchData();
}}
```

Porém, o dropdown de status **não faz isso**:

```typescript
// updateConversationStatus (linhas 1305-1309)
if (selectedConversation?.id === assignmentId) {
  setSelectedConversation(prev => prev ? {
    ...prev,
    status: newStatus  // ❌ Apenas atualiza status, não limpa
  } : null);
}
```

## Modificação Necessária

### Arquivo: `src/pages/RoyZapp.tsx`

Atualizar a função `updateConversationStatus` para **limpar a conversa selecionada** quando o novo status for `closed`:

```typescript
// ANTES (linhas 1304-1310)
// Update selected conversation locally
if (selectedConversation?.id === assignmentId) {
  setSelectedConversation(prev => prev ? {
    ...prev,
    status: newStatus
  } : null);
}

// DEPOIS
// When closing, clear selection so conversation disappears from view
if (newStatus === "closed" && selectedConversation?.id === assignmentId) {
  setSelectedConversation(null);
} else if (selectedConversation?.id === assignmentId) {
  // For other status changes, just update locally
  setSelectedConversation(prev => prev ? {
    ...prev,
    status: newStatus
  } : null);
}
```

## Resultado Visual

### Antes (bug atual):
1. Usuário clica no status → "Finalizado"
2. Toast mostra "Status alterado para: Finalizado"
3. Conversa SAI da lista lateral ✅
4. **Conversa CONTINUA aberta no chat** ❌

### Depois (correção):
1. Usuário clica no status → "Finalizado"
2. Toast mostra "Status alterado para: Finalizado"
3. Conversa SAI da lista lateral ✅
4. **Painel de chat volta ao estado vazio** ✅

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/RoyZapp.tsx` (linhas 1304-1310) | Limpar `selectedConversation` quando status = `closed` |

## Resultado Esperado

1. ✅ Conversa finalizada desaparece imediatamente da lista lateral
2. ✅ Painel de chat é limpo, mostrando estado vazio (ou próxima conversa)
3. ✅ Usuário não fica confuso com conversa "fantasma" aberta
4. ✅ Comportamento consistente entre dropdown e dialog de finalização
