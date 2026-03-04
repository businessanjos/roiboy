

## Problema

O funil mostra "Ganhos: 1" mas todas as etapas anteriores aparecem com 0. Isso é logicamente impossível — se um negócio foi ganho, ele obrigatoriamente passou por todas as etapas anteriores.

## Causa raiz

Nos componentes `ConfigurableFunnel.tsx` e `SalesFunnelChart.tsx`, a lógica de contagem cumulativa (de baixo para cima) **exclui "Ganhos"** da base do acumulador. A última etapa regular começa com base `0`, então se nenhuma etapa regular tem deals no período, os valores ficam todos zerados — mesmo que exista 1 deal ganho.

```text
Lógica atual (base = 0):
Follow Up:    0 + 0 = 0
Proposta:     0 + 0 = 0
...todas = 0
Ganhos:       1  (isolado, não propaga)

Lógica correta (base = Ganhos):
Follow Up:    0 + 1 = 1
Proposta:     0 + 1 = 1
...todas ≥ 1
Ganhos:       1
```

## Alterações

### 1. `src/components/insights/visuals/ConfigurableFunnel.tsx` — linha 41

Trocar a base `0` pelo valor de Ganhos:

```typescript
// DE:
const below = i < regularData.length - 1 ? cumulativeCounts[i + 1] : 0;

// PARA:
const below = i < regularData.length - 1 ? cumulativeCounts[i + 1] : (ganhosItem?.value || 0);
```

### 2. `src/components/insights/whatsapp-dashboard/SalesFunnelChart.tsx` — linha 85

Mesma correção no funil do WhatsApp Dashboard. A etapa "Venda" (equivalente a Ganhos) já é a última em `visibleStages`, então aqui o acumulador base (`belowTotal`) já inclui "Venda" na cadeia. **Porém**, como "Venda" é incluída inline em `allStagesWithVenda`, ela já participa do loop cumulativo — este componente não tem o mesmo bug. Nenhuma alteração necessária aqui.

## Resultado esperado

- Se existe 1 deal ganho, **todas** as etapas anteriores mostram no mínimo 1 no valor cumulativo
- O funil mantém forma de afunilamento correta mesmo com filtros de data restritivos

