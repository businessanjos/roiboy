
# Plano: Corrigir Renderização do Scorecard

## Problema Identificado

O Scorecard está sendo exibido como gráfico de barras porque existe uma **incompatibilidade de nomenclatura** entre os arquivos:

| Arquivo | Valor usado | Resultado |
|---------|-------------|-----------|
| `AddVisualModal.tsx` | `'scorecard'` | Salva no banco como "scorecard" |
| `types.ts` (ChartType) | `'number'` | Tipo esperado é "number" |
| `ConfigurableChart.tsx` | `case 'number':` | Procura por "number", não encontra "scorecard" |

O switch no `ConfigurableChart.tsx` não possui um case para `'scorecard'`, então cai no `default` que renderiza `BarChartView`.

---

## Solução Proposta

### Opção Escolhida: Adicionar suporte a `'scorecard'` no ConfigurableChart

A solução mais segura é fazer o `ConfigurableChart` reconhecer **ambos** os valores (`'number'` e `'scorecard'`) para manter compatibilidade com visuais existentes e futuros.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/insights/visuals/ConfigurableChart.tsx` | Adicionar `case 'scorecard':` no switch |
| `src/components/insights/visual-builder/types.ts` | Atualizar `ChartType` para incluir `'scorecard'` |

---

## Alterações Técnicas

### 1. types.ts - Atualizar ChartType

```typescript
// Linha 5: Adicionar 'scorecard' ao tipo
export type ChartType = 'bar' | 'line' | 'pie' | 'number' | 'scorecard';
```

### 2. ConfigurableChart.tsx - Adicionar case para scorecard

```typescript
// Linha 54-56: Modificar switch para incluir 'scorecard'
switch (type) {
  case 'number':
  case 'scorecard':  // ← Adicionar este case
    return <ConfigurableScorecard data={data} formatting={formatting} />;
  case 'bar':
    return <BarChartView ... />;
  // ...
}
```

---

## Resultado Esperado

Após a correção, o Scorecard será exibido corretamente como um card simples mostrando apenas o valor:

```text
ANTES (Errado - gráfico de barras)
┌─────────────────────┐
│ R$38.0M ─           │
│ R$19.0M ─  ████     │
│ R$0 ─────  Total    │
└─────────────────────┘

DEPOIS (Correto - card simples)
┌─────────────────────┐
│                     │
│     R$ 38.0M        │
│   123 registros     │
│                     │
└─────────────────────┘
```
