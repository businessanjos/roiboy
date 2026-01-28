
# Plano: Melhorar Funcionalidade de Fixar Grupos no ROY zAPP

## Diagnóstico

A funcionalidade de "Fixar" conversas/grupos **já existe** no código e está funcionando tecnicamente. No entanto, há um problema de usabilidade:

### Problema Identificado
Quando um grupo é **fixado** mas seu ticket é **fechado (closed)**, ele desaparece da lista de grupos. Isso acontece porque:

```typescript
// ZappConversationList.tsx - linhas 84-92
// Filter by closed status - BUT GROUPS ALWAYS SHOW (they're permanent conversations)
const isClosed = a.status === "closed";
if (showClosed) {
  if (!isClosed) return false;
} else {
  // When not showing closed, HIDE closed conversations
  if (isClosed) return false;  // ← GRUPOS FIXADOS SÃO ESCONDIDOS AQUI
}
```

O comentário menciona "GROUPS ALWAYS SHOW" mas a implementação **não respeita isso para grupos fixados**.

## Solução

Modificar a lógica de filtragem para que **grupos fixados sempre apareçam** na aba de grupos, independentemente do status de "closed".

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/royzapp/ZappConversationList.tsx` | Excluir grupos fixados da filtragem de status "closed" |

### Mudança Detalhada

```typescript
// ANTES (linha 84-92)
const isClosed = a.status === "closed";
if (showClosed) {
  if (!isClosed) return false;
} else {
  if (isClosed) return false;
}

// DEPOIS
const isClosed = a.status === "closed";
const isPinned = contact.isPinned;

// Grupos fixados SEMPRE aparecem na aba de grupos, mesmo se "closed"
const skipClosedFilter = isGroup && isPinned;

if (!skipClosedFilter) {
  if (showClosed) {
    if (!isClosed) return false;
  } else {
    if (isClosed) return false;
  }
}
```

### Adicionar Seção Visual de "Grupos Fixados"

Para melhorar a experiência, também criaremos uma seção destacada no topo da lista quando `filterConversationType === "group"`:

```typescript
// Separar grupos fixados dos não-fixados quando na aba de grupos
const pinnedGroups = filtered.filter(a => getContactInfo(a).isGroup && getContactInfo(a).isPinned);
const regularGroups = filtered.filter(a => !(getContactInfo(a).isGroup && getContactInfo(a).isPinned));
```

A interface mostrará:

```
┌─────────────────────────────────┐
│ 📌 GRUPOS FIXADOS               │
├─────────────────────────────────┤
│ 🏢 Henrique & Leticia - Eternu... │
│ 🏢 Time Vendas - Diário          │
├─────────────────────────────────┤
│ 👥 OUTROS GRUPOS                │
├─────────────────────────────────┤
│ 🏢 Suporte Clientes             │
│ 🏢 Marketing Team               │
└─────────────────────────────────┘
```

## Funcionalidade Existente (já funciona)

O usuário pode fixar qualquer conversa/grupo através do menu de 3 pontinhos (⋮) de cada item na lista:

1. Clicar nos 3 pontinhos da conversa/grupo
2. Selecionar "Fixar conversa" 📌
3. A conversa aparece com um ícone de pin e vai para o topo

## Resultado Esperado

1. ✅ Grupos fixados aparecem **sempre** na aba de grupos, mesmo com ticket fechado
2. ✅ Seção visual destacada "Grupos Fixados" no topo da lista
3. ✅ A ordenação continua priorizando fixados primeiro
4. ✅ O ícone de pin (📌) aparece ao lado do nome do grupo fixado

## Impacto

- Nenhuma mudança no banco de dados (o campo `is_pinned` já existe)
- Melhora significativa na usabilidade para acesso rápido a grupos frequentes
- Comportamento consistente: grupos permanentes não somem quando o ticket fecha

## Fluxo de Uso

```
1. Usuário vai para aba de Grupos 👥
2. Clica nos 3 pontinhos de um grupo frequente
3. Clica em "Fixar conversa" 📌
4. Grupo aparece na seção "Grupos Fixados" no topo
5. Mesmo que alguém finalize o atendimento, o grupo permanece visível
6. Usuário pode enviar mensagem diretamente sem abrir nova conversa
```
