
# Plano: Corrigir Acesso Cross-Setor para Conversas Individuais

## Diagnóstico

O erro "Conversa individual pertence a outro setor" ocorre por uma **race condition** no fluxo de criação de conversas:

```text
┌──────────────────────────────────────────────────────────────┐
│ Fluxo Atual (Bug)                                            │
├──────────────────────────────────────────────────────────────┤
│ 1. Usuario clica em "Nova Conversa" e seleciona contato      │
│ 2. Sistema cria assignment no banco de dados                 │
│ 3. Sistema faz setSelectedConversation(newAssignment)        │
│ 4. Sistema chama fetchData() para atualizar lista            │
│ 5. ANTES do fetchData completar, useEffect é disparado       │
│ 6. useEffect verifica: "assignment existe em assignments?"   │
│ 7. assignments ainda está VAZIO (fetchData não completou)    │
│ 8. useEffect assume que é de outro setor e limpa seleção     │
│ 9. Usuario vê "Conversa individual pertence a outro setor"   │
└──────────────────────────────────────────────────────────────┘
```

**Porque funciona para grupos?**
Grupos usam um padrão diferente que adiciona o assignment imediatamente à lista local:
```typescript
setSelectedConversation(enrichedAssignment);
setAssignments(prev => [enrichedAssignment, ...prev]); // <-- Isso previne o race condition
```

## Solução

Aplicar o mesmo padrão usado para grupos às conversas individuais:

1. **Adicionar assignment imediatamente à lista local** após criar no banco
2. **Usar delay no fetchData** para evitar sobrescrever o estado local

## Arquivo a Modificar

`src/pages/RoyZapp.tsx`

## Mudanças Necessárias

### 1. Criar Conversa via "Nova Conversa" (linhas ~3312-3316)

**Código Atual:**
```typescript
if (newAssignmentData) {
  setSelectedConversation(newAssignmentData);
}

fetchData(); // Update list in background
```

**Código Corrigido:**
```typescript
if (newAssignmentData) {
  setSelectedConversation(newAssignmentData);
  // CRITICAL FIX: Add immediately to local list to prevent race condition
  setAssignments(prev => {
    const exists = prev.some(a => a.id === newAssignmentData.id);
    if (exists) return prev;
    return [newAssignmentData, ...prev];
  });
}

// CRITICAL FIX: Delay fetchData to prevent overwriting local state
setTimeout(() => fetchData(), 2000);
```

### 2. Criar Conversa via URL (linhas ~497-501)

Aplicar a mesma correção na função `createConversationFromUrl`:

**Código Atual:**
```typescript
if (newAssignmentData) {
  setSelectedConversation(newAssignmentData);
}

fetchData(); // Update list in background
```

**Código Corrigido:**
```typescript
if (newAssignmentData) {
  setSelectedConversation(newAssignmentData);
  // CRITICAL FIX: Add immediately to local list
  setAssignments(prev => {
    const exists = prev.some(a => a.id === newAssignmentData.id);
    if (exists) return prev;
    return [newAssignmentData, ...prev];
  });
}

// CRITICAL FIX: Delay fetchData to prevent overwriting local state  
setTimeout(() => fetchData(), 2000);
```

## Por que isso resolve?

```text
┌──────────────────────────────────────────────────────────────┐
│ Fluxo Corrigido                                              │
├──────────────────────────────────────────────────────────────┤
│ 1. Usuario clica em "Nova Conversa" e seleciona contato      │
│ 2. Sistema cria assignment no banco de dados                 │
│ 3. Sistema faz setSelectedConversation(newAssignment)        │
│ 4. Sistema faz setAssignments([newAssignment, ...prev])      │
│ 5. useEffect é disparado                                     │
│ 6. useEffect verifica: "assignment existe em assignments?"   │
│ 7. SIM - assignment foi adicionado na etapa 4                │
│ 8. useEffect retorna sem fazer nada                          │
│ 9. Conversa abre normalmente                                 │
│ 10. 2 segundos depois, fetchData() sincroniza com banco      │
└──────────────────────────────────────────────────────────────┘
```

## Resumo das Alterações

| Local | Alteração |
|-------|-----------|
| Linha ~3312-3316 (createConversationWithContact) | Adicionar assignment à lista local + delay fetchData |
| Linha ~497-501 (createConversationFromUrl) | Mesma correção acima |

## Notas Técnicas

- A correção segue o mesmo padrão já utilizado para grupos (linhas 3098-3109)
- O delay de 2 segundos no fetchData evita que o fetch do banco sobrescreva o estado local antes da UI estabilizar
- A verificação `exists` previne duplicação na lista
