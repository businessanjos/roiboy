

# Plano: Corrigir Grupos Não Aparecendo na Lista Lateral

## Diagnóstico Detalhado

Após investigação minuciosa, identifiquei **dois problemas** que estão causando o grupo não aparecer na lista lateral:

### Problema 1: O novo assignment não é adicionado à lista local

Quando o usuário inicia uma nova conversa com um grupo:

```typescript
// Linha 2860 - RoyZapp.tsx
if (newAssignment) setSelectedConversation(newAssignment);  // Seleciona a conversa

// Linha 2864
fetchData();  // Tenta atualizar a lista
```

**O problema**: `setSelectedConversation` apenas define qual conversa está aberta no chat, mas **NÃO adiciona o assignment à lista `assignments`**. E `fetchData()` é uma operação assíncrona que pode demorar.

### Problema 2: O `fetchData` pode não executar imediatamente

No hook `useZappData.tsx`, há throttling que pode impedir a atualização:

```typescript
// Linha 132-134 - useZappData.tsx
if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) {
  return; // Ignora se chamado dentro de 3 segundos
}
```

Isso significa que se o usuário acabou de abrir a página, a próxima chamada `fetchData()` pode ser ignorada!

## Solução

Modificar o código para **adicionar manualmente o novo assignment à lista local** imediatamente, garantindo que apareça na sidebar instantaneamente.

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | Adicionar assignment à lista local após criar/reabrir grupo |

### Mudança 1: Reabrir grupo fechado (linhas 2839-2844)

```typescript
// ANTES
if (reopenedData) setSelectedConversation(reopenedData);

toast.success("Grupo reaberto!");
setNewConversationDialogOpen(false);
fetchData();
setCreatingConversation(false);
return;

// DEPOIS
if (reopenedData) {
  setSelectedConversation(reopenedData);
  // CRITICAL: Adicionar imediatamente à lista local para aparecer na sidebar
  setAssignments(prev => {
    const exists = prev.some(a => a.id === reopenedData.id);
    if (exists) {
      // Atualizar o existente
      return prev.map(a => a.id === reopenedData.id ? reopenedData : a);
    }
    // Adicionar no início da lista
    return [reopenedData, ...prev];
  });
}

toast.success("Grupo reaberto!");
setNewConversationDialogOpen(false);
fetchData(); // Atualização completa em background
setCreatingConversation(false);
return;
```

### Mudança 2: Criar novo assignment para grupo (linhas 2860-2865)

```typescript
// ANTES
if (newAssignment) setSelectedConversation(newAssignment);

toast.success("Grupo adicionado!");
setNewConversationDialogOpen(false);
fetchData();
setCreatingConversation(false);
return;

// DEPOIS
if (newAssignment) {
  setSelectedConversation(newAssignment);
  // CRITICAL: Adicionar imediatamente à lista local para aparecer na sidebar
  setAssignments(prev => [newAssignment, ...prev]);
}

toast.success("Grupo adicionado!");
setNewConversationDialogOpen(false);
fetchData(); // Atualização completa em background
setCreatingConversation(false);
return;
```

### Mudança 3: Mudar para aba de grupos automaticamente

Para garantir que o usuário veja o grupo na lista, também precisamos:

```typescript
// Adicionar após setNewConversationDialogOpen(false):
setFilterConversationType("group"); // Mudar para aba de grupos
```

## Fluxo Corrigido

```
1. Usuário clica em "Nova Conversa"
   ↓
2. Busca por "Financeiro Anjos" (grupo)
   ↓
3. Clica no grupo
   ↓
4. Sistema cria/reabre assignment
   ↓
5. Sistema ADICIONA à lista local (setAssignments)
   ↓
6. Sistema SELECIONA o grupo (setSelectedConversation)
   ↓
7. Sistema muda para aba de grupos (setFilterConversationType)
   ↓
8. Grupo aparece IMEDIATAMENTE na lista lateral
   ↓
9. Usuário pode clicar nos 3 pontinhos e "Fixar conversa"
   ↓
10. fetchData() atualiza dados em background
```

## Resultado Esperado

1. Grupo aparece **instantaneamente** na lista lateral após ser adicionado/reaberto
2. Usuário pode acessar menu de 3 pontinhos e fixar
3. Se fixado, grupo permanece visível mesmo após fechamento
4. Interface mais responsiva (sem esperar fetchData)

## Impacto

- Nenhuma mudança no banco de dados
- Melhora significativa na UX (resposta instantânea)
- Mantém `fetchData()` para garantir dados atualizados em background
