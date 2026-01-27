
# Plano: Buscar Grupos pelo Nome no Dialog "Nova Conversa"

## Objetivo

Permitir que o botao "Nova Conversa" busque grupos WhatsApp pelo nome, alem de clientes, leads e contatos individuais. Por exemplo, ao digitar "Carlos e", o grupo "Carlos e Fernanda - Eternum Medic Club" devera aparecer nos resultados.

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/RoyZapp.tsx` | Adicionar busca de grupos na funcao `searchContacts` e tratamento especial em `createConversationWithContact` |
| `src/components/royzapp/dialogs/ZappNewConversationDialog.tsx` | Adicionar tipo 'group' na interface e exibir badge "Grupo" com icone |

## Alteracoes Tecnicas

### 1. Modificar Interface Contact (ZappNewConversationDialog.tsx)

**Codigo Atual:**
```typescript
interface Contact {
  id: string;
  full_name: string;
  phone_e164: string;
  avatar_url: string | null;
  type?: 'client' | 'lead' | 'conversation';
  common_groups?: CommonGroup[];
}
```

**Codigo Novo:**
```typescript
interface Contact {
  id: string;
  full_name: string;
  phone_e164: string;
  avatar_url: string | null;
  type?: 'client' | 'lead' | 'conversation' | 'group';
  common_groups?: CommonGroup[];
  group_jid?: string; // Para identificar grupos
}
```

### 2. Adicionar Badge "Grupo" no Dialog (ZappNewConversationDialog.tsx)

Adicionar apos os badges existentes:

```typescript
{client.type === 'group' && (
  <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs whitespace-nowrap flex items-center gap-1">
    <Users className="h-3 w-3" />
    Grupo
  </Badge>
)}
```

E para grupos, mostrar o numero de participantes em vez do telefone:

```typescript
<p className="text-[#8696a0] text-sm truncate">
  {client.type === 'group' ? 'Grupo do WhatsApp' : client.phone_e164}
</p>
```

### 3. Adicionar Busca de Grupos em searchContacts (RoyZapp.tsx)

Na funcao `searchContacts`, adicionar uma quarta query paralela:

```typescript
// 4. Search groups by name
supabase
  .from("zapp_conversations")
  .select("id, contact_name, avatar_url, group_jid")
  .eq("account_id", currentUser.account_id)
  .eq("is_group", true)
  .ilike("contact_name", `%${textSearch}%`)
  .order("last_message_at", { ascending: false })
  .limit(10),
```

E mapear os resultados:

```typescript
const groups = (groupsResult.data || []).map(g => ({
  id: g.id,
  full_name: g.contact_name || "Grupo",
  phone_e164: "", // Grupos nao tem telefone
  avatar_url: g.avatar_url,
  type: 'group' as const,
  group_jid: g.group_jid,
}));
```

Combinar grupos na lista final (sem deduplicacao por telefone, pois grupos nao tem telefone):

```typescript
// Grupos sao adicionados diretamente sem filtro de telefone
const combined = [...clients, ...leads, ...conversations];
// ... filtragem por telefone existente ...
const finalCombined = [...filteredByPhone, ...groups];
```

### 4. Modificar createConversationWithContact para Grupos (RoyZapp.tsx)

No inicio da funcao, detectar se e um grupo:

```typescript
const createConversationWithContact = async (contact: any) => {
  if (!currentUser?.account_id || !currentAgent) return;
  
  setCreatingConversation(true);
  try {
    // NOVO: Se for grupo, tratar de forma especial
    if (contact.type === 'group') {
      // Grupos ja existem como zapp_conversation, apenas buscar/criar assignment
      const zappConvId = contact.id; // O id ja e o zapp_conversation.id
      
      // Buscar assignment existente para este grupo neste departamento
      const { data: existingAssignments } = await supabase
        .from("zapp_conversation_assignments")
        .select("id, agent_id, status, department_id")
        .eq("zapp_conversation_id", zappConvId)
        .eq("department_id", currentSectorDepartmentId)
        .order("created_at", { ascending: false });
      
      const activeAssignment = existingAssignments?.find(a => a.status !== 'closed');
      const closedAssignment = existingAssignments?.find(a => a.status === 'closed');
      
      if (activeAssignment) {
        // Abrir conversa existente
        const { data: assignmentData } = await supabase
          .from("zapp_conversation_assignments")
          .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
          .eq("id", activeAssignment.id)
          .single();
        
        if (assignmentData) setSelectedConversation(assignmentData);
        fetchData();
        toast.info("Abrindo grupo existente");
        setNewConversationDialogOpen(false);
        setCreatingConversation(false);
        return;
      } else if (closedAssignment) {
        // Reabrir grupo fechado
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
      } else {
        // Criar novo assignment para o grupo
        await supabase
          .from("zapp_conversation_assignments")
          .insert({
            account_id: currentUser.account_id,
            zapp_conversation_id: zappConvId,
            agent_id: null,
            status: "triage",
            department_id: currentSectorDepartmentId,
          });
        
        toast.success("Grupo adicionado a Fila!");
        setInboxTab("queue");
        setNewConversationDialogOpen(false);
        fetchData();
        setCreatingConversation(false);
        return;
      }
    }
    
    // ... resto do codigo existente para contatos individuais ...
```

## Fluxo do Usuario

```text
1. Usuario clica em "Nova Conversa"
2. Digita "Carlos e" no campo de busca
3. Sistema busca em:
   - Clientes com nome contendo "Carlos e"
   - Leads com nome contendo "Carlos e"
   - Contatos individuais com nome contendo "Carlos e"
   - NOVO: Grupos com nome contendo "Carlos e"
4. Aparece "Carlos e Fernanda - Eternum Medic Club" com badge "Grupo"
5. Usuario clica no grupo
6. Sistema verifica se ja tem assignment para este setor
7. Se sim: abre conversa existente
8. Se nao: cria assignment e coloca na fila
9. Usuario pode interagir com o grupo
```

## Resultado Visual

Os resultados de busca mostrarao:
- **Clientes**: Badge verde "Cliente" + telefone
- **Leads**: Badge amarelo "Lead" + telefone
- **Contatos**: Badge cinza "Contato" + telefone
- **Grupos**: Badge azul "Grupo" com icone de pessoas + "Grupo do WhatsApp"

## Beneficios

- Usuarios podem encontrar grupos rapidamente pelo nome
- Interface consistente com tipos de contato existentes
- Reuso da logica de assignment existente
- Grupos podem ser reabertos/adicionados a fila normalmente
