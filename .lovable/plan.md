
# Plano: Corrigir Desaparecimento de Grupos no ROY zAPP

## Problema Identificado

Os grupos do WhatsApp estão desaparecendo porque a lógica de filtragem no `RoyZapp.tsx` esconde conversas com status `closed`, **sem exceção para grupos**.

### Dados do Banco de Dados
No setor Operações existem 46 grupos:
- **42 grupos com status `closed`** (escondidos)
- 3 grupos com status `active`
- 1 grupo com status `waiting`

### Causa Raiz
Existem **dois níveis de filtragem** que deveriam ter a mesma lógica:

1. **RoyZapp.tsx (linha 2946-2949)** - Faz pré-filtragem SEM exceção para grupos
2. **ZappConversationList.tsx (linha 92)** - Tem a exceção correta para grupos

O código em RoyZapp.tsx:
```typescript
} else if (filterStatus === "all") {
  // When showing "all", hide closed unless explicitly requested
  if (isClosed) return false;  // ❌ Esconde TODOS os fechados, incluindo grupos
}
```

O código correto em ZappConversationList.tsx:
```typescript
// EXCEPTION: Groups are always visible (they're permanent, not tickets)
if (isClosed && !isGroup) return false;  // ✅ Mantém grupos visíveis
```

## Solução

Adicionar a mesma exceção para grupos na filtragem do `RoyZapp.tsx`.

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/RoyZapp.tsx` | Adicionar exceção para grupos no filtro de conversas fechadas |

## Alteração Técnica

### Localização: `RoyZapp.tsx` linhas 2940-2949

**Código Atual:**
```typescript
// Closed conversations filter
// When filterStatus is "closed", show only closed
// Otherwise, HIDE closed conversations by default
const isClosed = a.status === "closed";
if (filterStatus === "closed") {
  if (!isClosed) return false;
} else if (filterStatus === "all") {
  // When showing "all", hide closed unless explicitly requested
  if (isClosed) return false;
}
```

**Código Corrigido:**
```typescript
// Closed conversations filter
// When filterStatus is "closed", show only closed
// Otherwise, HIDE closed conversations by default
// CRITICAL EXCEPTION: Groups are permanent conversations and should NEVER be hidden
const contact = getContactInfo(a);
const isGroup = contact.isGroup;
const isClosed = a.status === "closed";

if (filterStatus === "closed") {
  if (!isClosed) return false;
} else if (filterStatus === "all") {
  // When showing "all", hide closed INDIVIDUAL conversations
  // But ALWAYS keep groups visible - they are permanent, not tickets
  if (isClosed && !isGroup) return false;
}
```

### Ajuste de Ordem
Como `getContactInfo` é chamado na linha 2960 atualmente, precisamos mover essa chamada para antes da verificação de closed status, ou duplicar a verificação de isGroup.

A solução mais eficiente é reorganizar o código para chamar `getContactInfo` uma vez no início do filtro e reutilizar.

## Fluxo Corrigido

```text
1. Grupo tem ticket finalizado → status = "closed"
2. Filtro em RoyZapp.tsx verifica:
   - isClosed? Sim
   - isGroup? Sim
   - Resultado: NÃO remove da lista (grupos são permanentes)
3. Grupo permanece visível na lista de conversas
```

## Impacto

- **42 grupos no setor Operações** voltarão a aparecer imediatamente
- Grupos de outros setores também serão corrigidos
- A lógica fica consistente entre RoyZapp.tsx e ZappConversationList.tsx
- Prevenção permanente: grupos NUNCA mais desaparecerão por terem status "closed"

## Por que o Problema Reapareceu?

O fix anterior foi feito apenas no `ZappConversationList.tsx`, mas o `RoyZapp.tsx` faz uma pré-filtragem independente antes de passar os dados para o componente de lista. Essa duplicação de lógica causou a inconsistência.

Com esta correção, a filtragem primária em RoyZapp.tsx já respeitará a regra de grupos permanentes, garantindo que o problema nunca mais ocorra.
