
# Plano: Corrigir Visibilidade de Grupos no ROY zAPP

## Diagnóstico do Problema

A investigação revelou que:

1. **O componente `ZappConversationList.tsx` onde adicionamos a lógica de grupos fixados NÃO ESTÁ SENDO USADO** - ele nunca é importado no projeto
2. **A filtragem real acontece em `RoyZapp.tsx`** (linhas 3073-3139), que é passada para `ZappConversationPanel.tsx`
3. **A lógica de tabs bloqueia grupos**:
   - Aba "Minhas": só mostra conversas onde `agent_id === currentAgent?.id` (ou admin)
   - Aba "Fila": só mostra conversas onde `agent_id === null`
   - Se um grupo não tem agente atribuído, ele só aparece na "Fila", não em "Minhas"
   - Se um grupo está atribuído a outro agente, não aparece para o usuário atual

## Grupos vs Tickets - Diferença Conceitual

| Aspecto | Conversas Individuais | Grupos |
|---------|----------------------|--------|
| Natureza | Ticket temporário | Conversa permanente |
| Atribuição | Importante (quem atende) | Menos relevante (todos podem participar) |
| Fechamento | Finaliza atendimento | Grupo continua existindo |
| Visibilidade esperada | Só quem está atribuído | Todos do setor |

## Solução

Modificar a lógica de filtragem em `RoyZapp.tsx` para que **grupos sempre apareçam** quando o filtro de tipo de conversa for "group", independentemente da aba (Minhas/Fila) ou status de atribuição.

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | Modificar `filteredAssignments` para tratar grupos diferentemente |

### Mudança Detalhada (linhas 3073-3137)

```typescript
// ANTES (linhas 3100-3107)
const matchesTab = (filterArchived || filterStatus === "closed") ? true : (
  inboxTab === "mine" 
    ? (isAdmin || a.agent_id === currentAgent?.id)
    : a.agent_id === null
);

// DEPOIS
// Grupos ignoram o filtro de tabs quando estamos na aba de grupos
// Isso permite que grupos apareçam independentemente de quem está atribuído
const skipTabFilterForGroups = filterConversationType === "group" && isGroup;

const matchesTab = (filterArchived || filterStatus === "closed" || skipTabFilterForGroups) ? true : (
  inboxTab === "mine" 
    ? (isAdmin || a.agent_id === currentAgent?.id)
    : a.agent_id === null
);
```

### Mudança para Grupos Fixados (linhas 3089-3098)

Também precisamos garantir que grupos fixados não sejam filtrados por status "closed":

```typescript
// ANTES
const isClosed = a.status === "closed";
if (filterStatus === "closed") {
  if (!isClosed) return false;
} else if (filterStatus === "all") {
  if (isClosed) return false;
}

// DEPOIS
const isClosed = a.status === "closed";
const isPinned = contact.isPinned;

// Grupos fixados SEMPRE aparecem na aba de grupos, mesmo se fechados
const skipClosedFilterForPinnedGroups = isGroup && isPinned && filterConversationType === "group";

if (!skipClosedFilterForPinnedGroups) {
  if (filterStatus === "closed") {
    if (!isClosed) return false;
  } else if (filterStatus === "all") {
    if (isClosed) return false;
  }
}
```

### Adicionar UI de Grupos Fixados no ZappConversationPanel

Como `ZappConversationList` não é usado, precisamos adicionar a separação visual de grupos fixados diretamente em `ZappConversationPanel.tsx`:

```typescript
// No render de filteredAssignments, separar grupos fixados
{filterConversationType === "group" && (
  <>
    {/* Seção de Grupos Fixados */}
    {filteredAssignments.filter(a => getContactInfo(a).isGroup && getContactInfo(a).isPinned).length > 0 && (
      <>
        <div className="px-4 py-2 bg-zapp-bg-dark">
          <span className="text-xs font-medium text-zapp-accent flex items-center gap-1.5">
            <Pin className="h-3 w-3" />
            GRUPOS FIXADOS
          </span>
        </div>
        {/* Mapear grupos fixados */}
      </>
    )}
    {/* Seção de Outros Grupos */}
  </>
)}
```

## Fluxo Corrigido

```
1. Usuário clica no ícone de Grupos na sidebar
   ↓
2. filterConversationType muda para "group"
   ↓
3. filteredAssignments agora inclui:
   - TODOS os grupos do setor (ignorando aba Minhas/Fila)
   - Grupos fixados aparecem mesmo se "closed"
   ↓
4. Lista mostra:
   📌 GRUPOS FIXADOS (se houver)
   - Grupo A
   - Grupo B
   👥 OUTROS GRUPOS  
   - Grupo C
   - Grupo D
```

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/pages/RoyZapp.tsx` | Modificar lógica de filtragem |
| `src/components/royzapp/ZappConversationPanel.tsx` | Adicionar UI de grupos fixados |

## Resultado Esperado

1. Ao clicar no ícone de grupos, **todos os grupos** do setor aparecem
2. Grupos fixados aparecem no topo com seção destacada
3. Grupos fixados permanecem visíveis mesmo após ticket "fechado"
4. O menu de 3 pontinhos continua funcionando para fixar/desafixar
5. A aba Minhas/Fila não afeta a visualização de grupos

## Impacto

- Nenhuma mudança no banco de dados
- Nenhuma mudança nas APIs
- Apenas ajustes de lógica frontend
- Componente `ZappConversationList.tsx` pode ser removido (não usado)
