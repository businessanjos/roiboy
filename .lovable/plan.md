
# Plano: Corrigir Acesso Cross-Setor para Conversas Individuais

## Diagnóstico Confirmado

O problema é causado por um **filtro incorreto de `integration_id`** que impede o acesso cross-setor a conversas individuais.

### Fluxo do Bug

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ CENÁRIO DO PROBLEMA                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Vendas cria conversa com cliente (integration_id = "vendas-inst")    │
│ 2. Conversa é transferida para Operações (department_id = "operacoes")  │
│ 3. Usuário de Operações usa integration_id = "operacoes-inst"           │
│ 4. useZappData filtra: conv.integration_id !== "operacoes-inst"         │
│ 5. Conversa é REMOVIDA da lista assignments                             │
│ 6. useEffect detecta: selectedConversation não está em assignments      │
│ 7. Sistema dispara: "Conversa individual pertence a outro setor"        │
└─────────────────────────────────────────────────────────────────────────┘

EVIDÊNCIA DOS LOGS:
"Filtered from 340 to 313 by integrationId dbb6109c-..."
= 27 conversas REMOVIDAS incorretamente!
```

### Conceitos Importantes

| Conceito | Propósito | Deve Filtrar? |
|----------|-----------|---------------|
| `department_id` (assignment) | Define qual SETOR é responsável | SIM - Isolamento de setor |
| `integration_id` (conversation) | Define qual INSTÂNCIA WhatsApp usa | NÃO - Apenas para envio |

## Solução Proposta

**Remover o filtro de `integration_id` para visibilidade de conversas.**

O `integration_id` no `zapp_conversation` serve apenas para saber qual instância WhatsApp usar para enviar mensagens, **não** para controlar visibilidade. O controle de visibilidade é feito pelo `department_id` no assignment.

### Arquivos a Modificar

#### 1. `src/hooks/useZappData.tsx`

**Remover o filtro de integration_id na função `fetchAssignmentsOnly`** (linhas ~209-222):

```typescript
// REMOVER ESTE BLOCO:
let filteredAssignments = assignmentsData || [];
if (integrationId) {
  filteredAssignments = filteredAssignments.filter((a: any) => {
    const conv = a.zapp_conversation;
    if (!conv) return true;
    if (conv.is_group) return true;
    return conv.integration_id === integrationId || !conv.integration_id;
  });
}
```

**Substituir por:**
```typescript
// CONVERSAS SÃO FILTRADAS APENAS POR department_id (já feito na query)
// O integration_id é usado APENAS para envio de mensagens, não para visibilidade
const filteredAssignments = assignmentsData || [];
console.log(`[ZappData] Fetched ${filteredAssignments.length} assignments for department ${dept.id} (sector: ${sectorId})`);
```

**Remover o filtro de integration_id na função `fetchData`** (linhas ~465-481):

```typescript
// REMOVER ESTE BLOCO:
let filteredAssignments = assignmentsData || [];
if (integrationId) {
  filteredAssignments = filteredAssignments.filter((a: any) => {
    // ... filtro por integration_id
  });
}
```

**Substituir por:**
```typescript
// CONVERSAS SÃO FILTRADAS APENAS POR department_id (já feito na query)
// O integration_id define qual instância WhatsApp usar para ENVIAR, não visibilidade
const filteredAssignments = assignmentsData || [];
```

#### 2. `src/pages/RoyZapp.tsx`

**Opcional: Melhorar o useEffect de validação** para logar mais contexto quando detectar problema (ajuda debug futuro):

```typescript
// Linha ~252 - adicionar mais contexto no log
console.log("[RoyZapp] Individual conversation from another sector", {
  selectedId: selectedConversation.id,
  assignmentsCount: assignments.length,
  existsInList: assignments.some(a => a.id === selectedConversation.id),
  conversationIntegrationId: selectedConversation.zapp_conversation?.integration_id,
  selectedIntegrationId,
});
```

## Impacto da Mudança

| Antes | Depois |
|-------|--------|
| 27 conversas filtradas em Operações | Todas as 340 conversas visíveis |
| Erro "pertence a outro setor" | Conversas acessíveis normalmente |
| Filtro por integration_id bloqueia | Filtro apenas por department_id |

## Segurança Mantida

O isolamento de setor **continua funcionando** porque:

1. A query do banco filtra por `department_id` (linha 190)
2. Cada setor tem seu próprio department_id
3. Conversas só aparecem se tiverem assignment naquele departamento
4. `integration_id` continua sendo usado para ENVIAR mensagens (define qual instância WhatsApp usar)

## Nota sobre Multi-Instância

Se um setor tiver múltiplas instâncias WhatsApp (ex: Vendas com 2 números), o filtro por `integration_id` pode fazer sentido **dentro do mesmo setor** para que cada atendente veja apenas conversas do seu número. Mas isso deve ser implementado de forma diferente:

- Criar um toggle "Ver apenas minhas conversas" no UI
- Não bloquear acesso cross-setor

Por enquanto, remover o filtro resolve o problema reportado.

## Resumo Técnico

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useZappData.tsx` | Remover filtro de `integration_id` em `fetchAssignmentsOnly` (~linhas 209-222) |
| `src/hooks/useZappData.tsx` | Remover filtro de `integration_id` em `fetchData` (~linhas 465-481) |
| `src/pages/RoyZapp.tsx` | (Opcional) Melhorar logs de debug |
