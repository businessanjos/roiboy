
# Plano: Exibir Todos os Meses e Rótulos de Dados no Gráfico

## Situação Atual

O sistema já possui a infraestrutura para o que você precisa:

| Funcionalidade | Config | Valor Atual |
|----------------|--------|-------------|
| Preencher meses vazios | `fillEmptyDates` | `false` |
| Exibir rótulos nas barras | `showDataLabels` | `false` |

Ambas estão **desabilitadas por padrão** — por isso o gráfico só mostra os meses que têm dados.

---

## Solução Proposta

### Correção 1: Ativar Defaults Inteligentes para Visuais Temporais

Quando um visual usa agrupamento "Por Mês" (ou outro temporal), automaticamente habilitar:
- `fillEmptyDates: true` → mostra todos os meses do período
- `showDataLabels: true` → exibe valores nas barras

**Arquivo:** `src/components/insights/AddVisualModal.tsx`

```typescript
// No handleCreate, ajustar appearance baseado no tipo de agrupamento
const isTemporalGrouping = baseDimensionConfig.type === 'date';

const config: VisualConfig = {
  // ... outras configurações
  appearance: {
    ...DEFAULT_APPEARANCE,
    // Ativar automaticamente para agrupamentos temporais
    fillEmptyDates: isTemporalGrouping,
    showDataLabels: isTemporalGrouping,
  },
};
```

### Correção 2: Atualizar o Visual Existente

Atualizar a configuração do visual "Faturamento por Mês" no banco para ativar as opções:

```sql
UPDATE insights_visuals
SET config = jsonb_set(
  jsonb_set(
    config,
    '{appearance,fillEmptyDates}',
    'true'
  ),
  '{appearance,showDataLabels}',
  'true'
)
WHERE title = 'Faturamento por Mês'
  AND (config->>'dataSource') = 'deals';
```

---

## Resultado Esperado

### Antes
- Eixo X: apenas "jan/26" (meses com dados)
- Barras: sem rótulos

### Depois
- Eixo X: jan/26, fev/26, mar/26... dez/26 (todos os meses do filtro)
- Barras: cada uma com valor formatado (ex: "R$3,5M")

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/insights/AddVisualModal.tsx` | Ativar `fillEmptyDates` e `showDataLabels` para agrupamentos temporais |
| Banco de dados | Atualizar config do visual existente |

---

## Detalhes Técnicos

A função `fillMissingDates` em `useVisualData.ts` já usa `eachMonthOfInterval` do `date-fns` para gerar todos os meses entre `startDate` e `endDate` definidos no filtro global. Portanto:

- Se o filtro for "Janeiro 2026", aparece só janeiro
- Se o filtro for "2026 inteiro", aparecem todos os 12 meses

O componente `BarChartView` em `ConfigurableChart.tsx` já renderiza `LabelList` quando `appearance.showDataLabels` é `true`.

---

## Alternativa: Configuração Manual

Se preferir não alterar o default, você pode ativar essas opções manualmente:

1. Clique no ícone ⚙️ (engrenagem) no canto do visual
2. Ative "Exibir rótulos de dados"
3. Ative "Preencher datas vazias"
4. Clique "Salvar Alterações"

Recomendo a Correção 1 para que novos visuais temporais já venham configurados corretamente.
