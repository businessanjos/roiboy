
# Plano: Edição de Nome de Grupos no RoyZapp

## Problema Identificado

Quando o usuário tenta editar o nome de um grupo no RoyZapp, o sistema abre o dialog "Cadastrar Contato" que exige nome e telefone. Isso não faz sentido para grupos - grupos não precisam ser cadastrados como contatos e devem ter seu nome editado livremente.

---

## Solução

Criar um fluxo separado para edição de grupos que:
1. **Não exige cadastro de cliente/lead**
2. **Permite edição direta do nome do grupo**
3. **Atualiza tanto no WhatsApp quanto no banco de dados local**

---

## Alterações Técnicas

### 1. Novo Dialog: `ZappEditGroupDialog.tsx`

Criar um dialog simples para edição de grupos com:
- Campo de nome do grupo
- Botão de salvar
- Chamada à edge function `uazapi-manager` com ação `update_group_name`
- Atualização do `contact_name` na tabela `zapp_conversations`

```typescript
// Estrutura básica do dialog
interface ZappEditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  groupJid: string;
  currentName: string;
  onSuccess?: () => void;
}
```

### 2. Modificar `ZappChatHeader.tsx`

**Adicionar nova prop:**
```typescript
onOpenEditGroup?: () => void;
```

**Modificar o clique no header (linha 105-107):**

De:
```typescript
onClick={() => clientId && onOpenClientEdit(clientId)}
```

Para:
```typescript
onClick={() => {
  if (isGroup && onOpenEditGroup) {
    onOpenEditGroup();
  } else if (clientId) {
    onOpenClientEdit(clientId);
  }
}}
```

**Adicionar opção no menu dropdown para grupos:**
```typescript
{isGroup && onOpenEditGroup && (
  <DropdownMenuItem 
    className="text-zapp-text hover:bg-zapp-hover"
    onClick={onOpenEditGroup}
  >
    <Pencil className="h-4 w-4 mr-2" />
    Editar Grupo
  </DropdownMenuItem>
)}
```

### 3. Modificar `ZappChatView.tsx`

Propagar a nova prop `onOpenEditGroup`.

### 4. Modificar `RoyZapp.tsx`

**Adicionar estados:**
```typescript
const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
```

**Criar função de callback:**
```typescript
const openEditGroupDialog = () => {
  setEditGroupDialogOpen(true);
};
```

**Passar prop para ZappChatView:**
```typescript
onOpenEditGroup={
  selectedConversation?.zapp_conversation?.is_group 
    ? openEditGroupDialog 
    : undefined
}
```

**Renderizar o dialog:**
```tsx
{selectedConversation?.zapp_conversation?.is_group && (
  <ZappEditGroupDialog
    open={editGroupDialogOpen}
    onOpenChange={setEditGroupDialogOpen}
    conversationId={selectedConversation.zapp_conversation.id}
    groupJid={selectedConversation.zapp_conversation.group_jid || ""}
    currentName={selectedConversation.zapp_conversation.contact_name || ""}
    onSuccess={() => fetchData()}
  />
)}
```

### 5. Lógica de Atualização no Dialog

A função de salvar chamará:

```typescript
// 1. Atualizar nome no WhatsApp via UAZAPI
const { data, error } = await supabase.functions.invoke("uazapi-manager", {
  body: { 
    action: "update_group_name",
    group_id: groupJid,
    group_name: newName,
  },
});

// 2. Atualizar contact_name na zapp_conversations (backup/sync local)
await supabase
  .from("zapp_conversations")
  .update({ contact_name: newName })
  .eq("id", conversationId);
```

---

## Fluxo do Usuário

```text
Usuário clica no nome do grupo (header)
          │
          ▼
    É grupo? ─── Sim ──► Abre dialog "Editar Grupo"
       │                          │
       │                          ▼
       │                 Campo com nome atual
       │                          │
       │                          ▼
       │                 Usuário edita e clica "Salvar"
       │                          │
       │                          ▼
       │                 Chama uazapi-manager (update_group_name)
       │                          │
       │                          ▼
       │                 Atualiza zapp_conversations.contact_name
       │                          │
       │                          ▼
       │                 Toast: "Nome do grupo atualizado!"
       │
       └── Não ──► Comportamento anterior (abre cliente/cadastro)
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/components/royzapp/dialogs/ZappEditGroupDialog.tsx` | **CRIAR** - Dialog de edição de grupo |
| `src/components/royzapp/dialogs/index.ts` | Exportar novo dialog |
| `src/components/royzapp/ZappChatHeader.tsx` | Adicionar prop `onOpenEditGroup` e lógica condicional |
| `src/components/royzapp/ZappChatView.tsx` | Propagar nova prop |
| `src/pages/RoyZapp.tsx` | Adicionar estado, função e renderizar dialog |

---

## Benefícios

- Grupos podem ter nome editado sem precisar de cadastro
- Fluxo intuitivo - clicar no nome abre edição
- Sincronização com WhatsApp real via UAZAPI
- Atualização local para refletir imediatamente na interface
