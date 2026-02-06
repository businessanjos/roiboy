
# Plano: Corrigir Exibição de Tipos de Atividade por Setor

## Problema Identificado

O dropdown "Todos os tipos" no setor de Vendas exibe tipos de atividade de Operações (Onboarding, Implementação da Clínica Ryka, etc.) porque o hook `useActivityTypes()` é chamado **sem passar o `sectorId` do setor atual**.

### Código Atual (linha 188)
```tsx
// Não passa sectorId - retorna TODOS os tipos
const { activityTypes } = useActivityTypes();
```

### Comportamento do Hook (useActivityTypes.tsx linhas 34-38)
```tsx
// Filter by sector: include types for the specified sector OR types with no sector (null)
if (sectorId) {
  return allTypes.filter(
    type => type.sector_id === null || type.sector_id === sectorId
  );
}
// Se não passar sectorId, retorna TODOS
return allTypes;
```

---

## Solução

Passar o `currentSector?.id` para o hook `useActivityTypes()`:

### Alteração em `src/pages/Tasks.tsx` - Linha 188

**Antes:**
```tsx
// Activity types for filtering
const { activityTypes } = useActivityTypes();
```

**Depois:**
```tsx
// Activity types for filtering - filtered by current sector
const { activityTypes } = useActivityTypes(currentSector?.id);
```

---

## Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/pages/Tasks.tsx` | 188 | Passar `currentSector?.id` para `useActivityTypes()` |

---

## Resultado Esperado

| Setor Atual | Tipos Exibidos no Dropdown |
|-------------|---------------------------|
| Vendas | Ligação não atendida, No-Show, Proposta de Fechamento, Primeiro Contato + tipos sem setor |
| Operações | Onboarding, Implementação, Suporte + tipos sem setor |

Os tipos de atividade de outros setores não aparecerão mais no dropdown, resolvendo o problema de forma definitiva.
