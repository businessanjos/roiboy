
# Plano: Fazer Grupo Aparecer na Lista ao Iniciar Nova Conversa

## Problema

Ao clicar para iniciar uma nova conversa com um grupo no diálogo "Nova Conversa", o grupo **abre no chat** mas **não aparece na lista lateral** de conversas. Isso impede o usuário de fixar o grupo para acesso rápido.

## Causa Raiz

No código de `createConversationWithContact` (RoyZapp.tsx, linhas 2825-2856):

- **Quando o grupo já está ativo** (linha 2811-2824): O código **SELECIONA** o grupo (`setSelectedConversation`)
- **Quando o grupo está fechado ou é novo** (linhas 2825-2856): O código **NÃO SELECIONA** o grupo, apenas adiciona à fila

```typescript
// ✅ Funciona - grupo existente é selecionado
if (activeAssignment) {
  if (assignmentData) setSelectedConversation(assignmentData);  // ← Seleciona
  fetchData();
  ...
}

// ❌ Não funciona - grupo reaberto/novo não é selecionado
else if (closedAssignment) {
  await supabase...update({ status: "triage" });
  setInboxTab("queue");
  fetchData();  // ← Não seleciona!
  ...
}
```

## Solução

Após criar ou reabrir um grupo, **buscar e selecionar o assignment** para que ele apareça na lista lateral e no chat.

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | Adicionar seleção do grupo após criar/reabrir assignment |

### Mudança Detalhada

#### Caso 1: Reabrir grupo fechado (linhas 2825-2837)

```typescript
// ANTES
} else if (closedAssignment) {
  await supabase
    .from("zapp_conversation_assignments")
    .update({ status: "triage", agent_id: null, updated_at: new Date().toISOString() })
    .eq("id", closedAssignment.id);
  
  toast.success("Grupo reaberto na Fila!");
  setInboxTab("queue");
  setNewConversationDialogOpen(false);
  fetchData();
  setCreatingConversation(false);
  return;
}

// DEPOIS
} else if (closedAssignment) {
  await supabase
    .from("zapp_conversation_assignments")
    .update({ status: "triage", agent_id: null, updated_at: new Date().toISOString() })
    .eq("id", closedAssignment.id);
  
  // Buscar e selecionar o assignment reaberto
  const { data: reopenedData } = await supabase
    .from("zapp_conversation_assignments")
    .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
    .eq("id", closedAssignment.id)
    .single();
  
  if (reopenedData) setSelectedConversation(reopenedData);
  
  toast.success("Grupo reaberto!");
  setNewConversationDialogOpen(false);
  fetchData();
  setCreatingConversation(false);
  return;
}
```

#### Caso 2: Criar novo assignment para grupo (linhas 2838-2856)

```typescript
// ANTES
} else {
  await supabase
    .from("zapp_conversation_assignments")
    .insert({
      account_id: currentUser.account_id,
      zapp_conversation_id: zappConvId,
      agent_id: null,
      status: "triage",
      department_id: currentSectorDepartmentId,
    });
  
  toast.success("Grupo adicionado à Fila!");
  setInboxTab("queue");
  setNewConversationDialogOpen(false);
  fetchData();
  setCreatingConversation(false);
  return;
}

// DEPOIS
} else {
  const { data: newAssignment } = await supabase
    .from("zapp_conversation_assignments")
    .insert({
      account_id: currentUser.account_id,
      zapp_conversation_id: zappConvId,
      agent_id: null,
      status: "triage",
      department_id: currentSectorDepartmentId,
    })
    .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
    .single();
  
  if (newAssignment) setSelectedConversation(newAssignment);
  
  toast.success("Grupo adicionado!");
  setNewConversationDialogOpen(false);
  fetchData();
  setCreatingConversation(false);
  return;
}
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
5. Sistema SELECIONA o grupo (setSelectedConversation)
   ↓
6. Grupo aparece na lista lateral (dentro do filtro de grupos)
   ↓
7. Usuário pode clicar nos 3 pontinhos → "Fixar conversa" 📌
```

## Resultado Esperado

1. ✅ Grupo aparece na lista lateral após ser selecionado
2. ✅ Usuário pode acessar menu de 3 pontinhos e fixar
3. ✅ Se fixado, grupo permanece visível mesmo após fechamento
4. ✅ Comportamento consistente com grupos já existentes

## Impacto

- Nenhuma mudança no banco de dados
- Apenas ajustes de lógica no frontend
- Melhora significativa na usabilidade de grupos
