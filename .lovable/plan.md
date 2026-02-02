
# Plano: Corrigir o Filtro de Integration que Remove Conversas Cross-Setor

## Diagnóstico Definitivo

O problema REAL foi encontrado! As correções anteriores de race condition estão sendo **completamente anuladas** por um filtro adicional no `useMemo` chamado `filteredAssignments`.

### Evidência dos Logs

```
[ZappData] fetchData: Loaded 340 assignments for sector operacoes
[ZappData] MULTI-INSTANCE: Filtered to 312 assignments for integration dbb6109c-...
                           ↑↑↑ AQUI ESTÁ O PROBLEMA ↑↑↑
```

O sistema carrega 340 conversas do banco, mas o `useMemo` filtra para 312, **removendo 28 conversas individuais** que não pertencem à instância WhatsApp atual.

### Fluxo do Bug

```text
┌────────────────────────────────────────────────────────────────────────┐
│ SEQUÊNCIA DO BUG                                                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Usuario clica em "Ana Paula Cardoso" no dialog "Nova Conversa"      │
│ 2. Sistema encontra assignment existente (criado por outra instância)  │
│ 3. Sistema chama setSelectedConversation(assignmentData)               │
│ 4. Sistema chama setAssignments(prev => [...prev, assignmentData])     │
│ 5. useMemo "filteredAssignments" RE-EXECUTA                            │
│ 6. useMemo filtra: conv.integration_id !== selectedIntegrationId       │
│ 7. useMemo REMOVE a conversa adicionada no passo 4                     │
│ 8. RoyZapp recebe assignments SEM a conversa selecionada               │
│ 9. useEffect de validação: "não existe em assignments"                 │
│ 10. Sistema limpa seleção: "Conversa pertence a outro setor"           │
└────────────────────────────────────────────────────────────────────────┘
```

### Código Problemático

```typescript
// src/hooks/useZappData.tsx - linhas 909-929
if (integrationId) {
  filtered = filtered.filter(a => {
    const matchesIntegration = convIntegrationId === integrationId;
    const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;
    const isGroup = zappConv?.is_group === true;
    
    // PROBLEMA: Remove conversas individuais de outras instâncias!
    return matchesIntegration || isLegacySameSector || isGroup;
  });
}
```

## Solução

Remover o filtro de `integration_id` do `useMemo`, já que:

1. O isolamento de setor é garantido pelo `department_id` (filtrado no SQL)
2. O `integration_id` serve apenas para definir qual instância WhatsApp usar para ENVIAR mensagens
3. Conversas podem ser acessadas de qualquer instância dentro do mesmo departamento

## Arquivo a Modificar

`src/hooks/useZappData.tsx`

## Mudança Necessária

### Remover o Bloco de Filtro por Integration (linhas 905-935)

**Código Atual:**
```typescript
// CRITICAL: If integrationId is specified, filter by integration_id but INCLUDE:
// 1. Legacy conversations (no integration_id) that belong to this sector
// 2. GROUPS - they are cross-integration by nature (user explicitly opened them)
// This prevents missing conversations after multi-instance migration
if (integrationId) {
  const beforeCount = filtered.length;
  filtered = filtered.filter(a => {
    const zappConv = a.zapp_conversation as { 
      integration_id?: string; 
      sector_id?: string;
      is_group?: boolean;
    } | null;
    const convIntegrationId = zappConv?.integration_id;
    const convSectorId = zappConv?.sector_id;
    const isGroup = zappConv?.is_group === true;
    
    const matchesIntegration = convIntegrationId === integrationId;
    const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;
    
    return matchesIntegration || isLegacySameSector || isGroup;
  });
  
  if (filtered.length !== beforeCount) {
    console.log(`[ZappData] MULTI-INSTANCE: Filtered to ${filtered.length}...`);
  }
}
```

**Código Corrigido:**
```typescript
// CROSS-SECTOR FIX: Remove integration_id filter entirely
// Visibility is controlled ONLY by department_id (filtered in SQL query)
// integration_id is used ONLY for sending messages (determines which WhatsApp instance to use)
// This allows conversations to be accessible cross-instance within the same department
console.log(`[ZappData] filteredAssignments: ${filtered.length} assignments for sector ${sectorId} (no integration filter)`);
```

## Por que vai funcionar

| Conceito | Antes | Depois |
|----------|-------|--------|
| Filtro de setor | department_id (SQL) | department_id (SQL) |
| Filtro de instância | integration_id (useMemo) | REMOVIDO |
| Conversas visíveis | 312 (filtradas) | 340 (todas do departamento) |
| Cross-instance | Bloqueado | Permitido |

## Impacto

1. Conversas de TODAS as instâncias WhatsApp do mesmo setor ficam visíveis
2. Não quebra isolamento de setor (isso continua no SQL)
3. Resolve 100% do erro "Conversa pertence a outro setor"

## Nota sobre Multi-Instância

Se o usuário quiser ver apenas conversas de uma instância específica, isso pode ser implementado como um **filtro opcional na UI** (toggle "Ver apenas minhas conversas"), não como um bloqueio de acesso.
