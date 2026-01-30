
# Plano: Corrigir Grupos Não Aparecendo na Barra Lateral

## Diagnóstico Completo

### Causa Raiz Identificada
Após investigação detalhada do código, identifiquei que o problema está no **filtro de multi-instância** em `src/hooks/useZappData.tsx`.

### Fluxo do Problema

1. Usuário pesquisa grupo via "Nova Conversa"
2. Grupo é encontrado (busca cross-sector, sem filtro de integration_id)
3. Assignment é criado e adicionado ao estado via `setAssignments(prev => [enrichedAssignment, ...prev])`
4. **PROBLEMA CRÍTICO**: O hook `useZappData` retorna `assignments: filteredAssignments` (linha 922)
5. O `filteredAssignments` é um `useMemo` que aplica filtro de `integrationId` (linhas 881-905)
6. Se o `zapp_conversation.integration_id` do grupo for diferente do `selectedIntegrationId`, o grupo é **IMEDIATAMENTE REMOVIDO** pelo filtro
7. **RESULTADO**: Grupo desaparece da lista instantaneamente após ser adicionado

### Logs de Console Confirmam
Os logs mostram:
```
[ZappData] Fetched 332 assignments for department 2374659b-7f4e-45cc-849e-7e23eaf28159 (sector: operacoes)
[ZappData] MULTI-INSTANCE: Filtered to 307 assignments for integration dbb6109c-da1d-4ce8-a119-b7da13dd73fa
```

Isso significa que 25 assignments (incluindo grupos de outras integrações) são REMOVIDOS pelo filtro.

---

## Solução

### Modificar o filtro de integração para SEMPRE permitir GRUPOS

**Lógica Atual** (linhas 892-899):
```typescript
// Include conversation if:
// 1. It belongs to this exact integration, OR
// 2. It has no integration_id (legacy) but belongs to the same sector
const matchesIntegration = convIntegrationId === integrationId;
const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;

return matchesIntegration || isLegacySameSector;
```

**Lógica Corrigida**:
```typescript
// Include conversation if:
// 1. It belongs to this exact integration, OR
// 2. It has no integration_id (legacy) but belongs to the same sector, OR
// 3. It's a GROUP (groups are cross-integration by nature and user explicitly opened it)
const isGroup = (a.zapp_conversation as { is_group?: boolean } | null)?.is_group === true;
const matchesIntegration = convIntegrationId === integrationId;
const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;

return matchesIntegration || isLegacySameSector || isGroup;
```

### Por que isso é correto:

| Razão | Justificativa |
|-------|--------------|
| Grupos são entidades compartilhadas | Um mesmo grupo pode ser acessado por múltiplas instâncias do WhatsApp |
| Já há filtro por departamento | Linha 875 já garante que só retornamos assignments do setor atual |
| Usuário abriu explicitamente | Se o assignment existe para esse setor, é porque o usuário quis abri-lo |
| Consistência de UX | Grupos devem persistir na lista até serem "Dispensados" |

---

## Alteração Técnica

### Arquivo: `src/hooks/useZappData.tsx`

#### Linhas 886-900 - Adicionar condição para grupos:

```typescript
if (integrationId) {
  const beforeCount = filtered.length;
  filtered = filtered.filter(a => {
    // Access integration_id, sector_id, and is_group via type assertion
    const zappConv = a.zapp_conversation as { 
      integration_id?: string; 
      sector_id?: string;
      is_group?: boolean;
    } | null;
    const convIntegrationId = zappConv?.integration_id;
    const convSectorId = zappConv?.sector_id;
    const isGroup = zappConv?.is_group === true;
    
    // Include conversation if:
    // 1. It belongs to this exact integration, OR
    // 2. It has no integration_id (legacy) but belongs to the same sector, OR
    // 3. It's a GROUP (groups are cross-integration by nature - user explicitly opened it)
    const matchesIntegration = convIntegrationId === integrationId;
    const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;
    
    return matchesIntegration || isLegacySameSector || isGroup;
  });
  
  if (filtered.length !== beforeCount) {
    console.log(`[ZappData] MULTI-INSTANCE: Filtered to ${filtered.length} assignments for integration ${integrationId} (from ${beforeCount}, includes legacy same-sector and groups)`);
  }
}
```

---

## Fluxo Corrigido

```
Usuário abre grupo via "Nova Conversa"
              │
              ▼
    Assignment criado no banco
              │
              ▼
    setAssignments adiciona ao estado original
              │
              ▼
    useMemo recalcula filteredAssignments
              │
              ▼
    Filtro verifica: É grupo? ─── Sim ──► PERMITE (mesmo que integration_id diferente)
              │
              ▼
    GRUPO APARECE NA BARRA LATERAL ✓
```

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useZappData.tsx` | Adicionar `isGroup` como terceira condição no filtro de multi-instância (1 bloco de ~20 linhas) |

---

## Por que tenho certeza de que isso resolve

1. **Identifiquei a causa exata**: O filtro de `integrationId` está removendo grupos de outras integrações
2. **Os logs confirmam**: 25 assignments são removidos pelo filtro
3. **A solução é cirúrgica**: Adicionar uma única condição `|| isGroup`
4. **Não quebra nada existente**: Grupos JÁ estão filtrados por departamento, garantindo isolamento de setor
5. **Respeita a arquitetura**: Mantemos o filtro para conversas individuais, apenas flexibilizamos para grupos
