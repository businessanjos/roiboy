
# Plano: Botão "Dispensar" para Grupos no RoyZapp

## Resumo do Pedido

Quando você abre um grupo via "Nova Conversa", o grupo deve aparecer na barra lateral esquerda e ficar lá **até que você clique em "Dispensar"**. 

A diferença para "Excluir conversa" é que "Dispensar" apenas **remove o assignment do setor atual**, sem apagar a conversa.

---

## O Que Vai Mudar

### Para o Usuário

| Ação | Comportamento |
|------|--------------|
| Abrir grupo via "Nova Conversa" | Grupo aparece na lista lateral |
| Clicar em "Dispensar" | Grupo sai da lista (assignment fechado) |
| Grupo em outro setor | Não é afetado (cada setor tem seu assignment) |

---

## Alterações Técnicas

### 1. Arquivo: `src/components/royzapp/ZappChatHeader.tsx`

**Adicionar botão "Dispensar" no menu de mais ações (DropdownMenu):**

- Adicionar nova prop: `onDismissConversation?: () => void`
- Adicionar nova prop: `isGroup?: boolean` 
- No menu DropdownMenu, **antes** do "Excluir conversa", adicionar:

```typescript
{isGroup && onDismissConversation && (
  <DropdownMenuItem 
    className="text-amber-500 hover:bg-amber-500/10"
    onClick={onDismissConversation}
  >
    <X className="h-4 w-4 mr-2" />
    Dispensar grupo
  </DropdownMenuItem>
)}
```

### 2. Arquivo: `src/components/royzapp/ZappChatView.tsx`

**Passar as novas props para o header:**

- Adicionar prop `onDismissConversation?: () => void`
- Passar para `ZappChatHeader`

### 3. Arquivo: `src/pages/RoyZapp.tsx`

**A. Criar função `dismissGroupConversation`:**

```typescript
const dismissGroupConversation = async () => {
  if (!selectedConversation) return;
  
  try {
    // Close this assignment (removes from current sector's list)
    await supabase
      .from("zapp_conversation_assignments")
      .update({ 
        status: "closed", 
        closed_at: new Date().toISOString() 
      })
      .eq("id", selectedConversation.id);
    
    toast.success("Grupo dispensado!");
    setSelectedConversation(null);
    
    // Remove from local state immediately
    setAssignments(prev => prev.filter(a => a.id !== selectedConversation.id));
  } catch (error) {
    console.error("Error dismissing group:", error);
    toast.error("Erro ao dispensar grupo");
  }
};
```

**B. Remover o `useEffect` de auto-criação de assignment para grupos:**

A lógica atual (linhas 171-255) que cria automaticamente assignments para grupos de outros setores será removida. Grupos só aparecerão quando o usuário abrir explicitamente via "Nova Conversa".

**C. Passar a função para o ZappChatView:**

No JSX onde renderiza `<ZappChatView>`, adicionar:

```typescript
onDismissConversation={
  selectedConversation?.zapp_conversation?.is_group 
    ? dismissGroupConversation 
    : undefined
}
```

### 4. Arquivo: `src/components/royzapp/ZappConversationItem.tsx`

**Adicionar opção "Dispensar" no menu do item (para grupos):**

- Adicionar prop: `onDismissConversation?: (assignmentId: string) => void`
- No DropdownMenuContent, adicionar antes de "Apagar conversa":

```typescript
{contact.isGroup && onDismissConversation && (
  <>
    <DropdownMenuItem 
      className="text-amber-500 hover:bg-amber-500/10"
      onClick={(e) => {
        e.stopPropagation();
        onDismissConversation(assignment.id);
      }}
    >
      <X className="h-4 w-4 mr-3" />
      Dispensar grupo
    </DropdownMenuItem>
    <DropdownMenuSeparator className="bg-zapp-border" />
  </>
)}
```

### 5. Atualizar `ZappConversationList.tsx` e `ZappConversationPanel.tsx`

Propagar a nova prop `onDismissConversation` através da cadeia de componentes.

---

## Fluxo Final

```text
Usuário clica em "Nova Conversa"
        │
        ▼
Pesquisa e seleciona um grupo
        │
        ▼
Sistema cria assignment no setor atual
        │
        ▼
Grupo aparece na barra lateral
        │
        │── Usuário trabalha normalmente
        │   
        ▼
Usuário clica no menu ⋮ do grupo
        │
        ├── "Dispensar grupo" → Fecha assignment, grupo sai da lista
        │
        └── "Excluir conversa" → Deleta permanentemente
```

---

## Diferença: Dispensar vs Excluir

| Ação | O que faz | Outros setores | Pode reabrir? |
|------|-----------|----------------|---------------|
| **Dispensar** | Fecha assignment no setor atual | Não afetados | Sim, via "Nova Conversa" |
| **Excluir** | Deleta conversa e mensagens | Também perdem | Não |

---

## Arquivos a Modificar

1. `src/pages/RoyZapp.tsx`
   - Criar função `dismissGroupConversation`
   - Remover useEffect de auto-criação de assignment
   - Passar função para ZappChatView

2. `src/components/royzapp/ZappChatHeader.tsx`
   - Adicionar props `isGroup` e `onDismissConversation`
   - Adicionar item "Dispensar grupo" no menu

3. `src/components/royzapp/ZappChatView.tsx`
   - Propagar nova prop

4. `src/components/royzapp/ZappConversationItem.tsx`
   - Adicionar opção "Dispensar" no menu da lista

5. `src/components/royzapp/ZappConversationList.tsx`
   - Propagar nova prop

6. `src/components/royzapp/ZappConversationPanel.tsx`
   - Propagar nova prop

---

## Benefícios

- Controle total do usuário sobre quais grupos aparecem
- Sem criação automática de assignments indesejados
- Cada setor gerencia seus próprios grupos de forma independente
- Ação reversível (pode reabrir via "Nova Conversa")
