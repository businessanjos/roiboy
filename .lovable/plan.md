

## Corrigir zoom individual por painel no Modo Foco

### Problema

O estado `focusZoom` em `InsightsMainContent.tsx` (linha 30) e um unico `useState(100)` que nao e resetado ao trocar de painel/dashboard. Quando o usuario ajusta o zoom no painel "Desempenho Diario" e depois navega para outro painel, o zoom permanece no valor anterior.

### Solucao

Adicionar um `useEffect` que reseta o `focusZoom` para 100 sempre que o `activeDashboardId` mudar.

### Mudanca tecnica

**Arquivo: `src/components/insights/InsightsMainContent.tsx`**

Adicionar apos a linha 40 (depois do useEffect do ESC):

```typescript
// Reset zoom when switching dashboards
useEffect(() => {
  setFocusZoom(100);
}, [activeDashboardId]);
```

Isso garante que cada painel sempre inicia com zoom 100%, independente do valor que estava configurado no painel anterior.

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/InsightsMainContent.tsx` | Adicionar useEffect para resetar focusZoom ao trocar de dashboard |

