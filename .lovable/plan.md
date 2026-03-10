

## Plano: Adicionar filtro e segmentação por Status do Negócio

### O que será feito

1. **Filtro por Status** na seção "Filtro por Negócio" do painel de ajustes do visual — adicionar uma opção fixa "Status" (Ganho, Em Aberto, Perdido) como primeiro item antes dos campos personalizados.

2. **Segmentação por Status** no dropdown "Segmentar por Campo (Legenda)" — adicionar uma opção fixa "Status do Negócio" que divide as barras/linhas por Ganho/Em Aberto/Perdido.

### Alterações por arquivo

**`src/components/insights/visuals/DealFieldFilterSection.tsx`**
- Adicionar uma seção fixa de filtro por Status (3 checkboxes: Ganho, Em Aberto, Perdido) acima dos filtros de campos personalizados
- Mapear os valores selecionados para o formato `statusFilter` do config (ou usar um novo campo `dealStatusFilter` com array de valores)
- Expandir as props para incluir `statusFilter` e `onStatusFilterChange`

**`src/components/insights/visuals/VisualQuickSettings.tsx`**
- Adicionar estado para `dealStatusFilter` (array de strings: 'won', 'open', 'lost')
- Passar para `DealFieldFilterSection` como prop
- No `handleSave`, converter o array de status selecionados para o campo adequado no config
- Na seção de segmentação, adicionar opção fixa "Status do Negócio" com valor especial `_status` antes dos campos personalizados

**`src/components/insights/visual-builder/types.ts`**
- Adicionar campo `dealStatusFilter?: string[]` ao `VisualConfig` para suportar filtro multi-valor de status (ex: `['won', 'open']`)
- Adicionar valor especial para `stackByCustomField` quando source é `_status`

**`src/hooks/useVisualData.ts`**
- Na função `fetchDealsData`, aplicar filtro `.in('status', dealStatusFilter)` quando o array estiver presente (substituindo o `statusFilter` simples se ambos existirem)

**`src/hooks/useStackedVisualData.ts`**
- Quando `stackByCustomField` tiver source `_status`, agrupar por `deal.status` ao invés de buscar campo personalizado
- Mapear valores internos para labels: `won` → "Ganho", `open` → "Em Aberto", `lost` → "Perdido"

### Arquivos alterados
- `src/components/insights/visual-builder/types.ts`
- `src/components/insights/visuals/DealFieldFilterSection.tsx`
- `src/components/insights/visuals/VisualQuickSettings.tsx`
- `src/hooks/useVisualData.ts`
- `src/hooks/useStackedVisualData.ts`

