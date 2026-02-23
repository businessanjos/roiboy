
## Criar visual "Qtde Leads MQL - Semana" com barras empilhadas horizontais

### Alteracoes necessarias

#### 1. `src/hooks/useStackedVisualData.ts` -- Ajustar label de semana

Na funcao `fetchStackedLeadsData`, o agrupamento por semana atualmente gera labels como `Sem 06/01`. Vou alterar para exibir o numero da semana do ano, ex: `Sem 01`, `Sem 02`, etc., usando `format(date, 'II')` do date-fns para obter o numero ISO da semana.

#### 2. `src/components/insights/visuals/ConfigurableChart.tsx` -- Controle de orientacao

Atualmente a orientacao e determinada automaticamente: `date -> vertical`, `categorico -> horizontal`. Preciso adicionar suporte a uma prop `chartOrientation` no `VisualConfig` para permitir override. Quando definida, ela prevalece sobre a logica automatica.

Logica atualizada:
```text
orientation = visualConfig?.chartOrientation 
  || (visualConfig?.dimension?.type === 'date' ? 'vertical' : 'horizontal')
```

#### 3. `src/components/insights/visual-builder/types.ts` -- Adicionar campo `chartOrientation`

Adicionar campo opcional `chartOrientation?: 'horizontal' | 'vertical'` no `VisualConfig`.

#### 4. Inserir visual no banco de dados

Inserir registro na tabela `insights_visuals` com:
- **Titulo**: "Qtde Leads MQL - Semana"
- **Tipo**: `bar_stacked`
- **Config**: mesma base do visual de dia, mas com `dateGrouping: 'week'` e `chartOrientation: 'horizontal'`
- **Dashboard**: `e9fdb6c9-5ede-4c88-9c26-acb5870b18dd`

### Secao tecnica

**Formato de label de semana**: Trocar `Sem ${format(ws, 'dd/MM')}` por `Sem ${format(ws, 'II')}` para mostrar numero da semana ISO do ano (01-52).

**Nova prop em VisualConfig**:
```text
chartOrientation?: 'horizontal' | 'vertical'
```

**Config do visual**:
```text
{
  dataSource: 'leads',
  measure: { field: '', aggregation: 'count' },
  dimension: { field: 'created_at', type: 'date', dateGrouping: 'week' },
  stackBy: 'canal',
  chartOrientation: 'horizontal',
  formatting: { type: 'decimal', decimals: 0 },
  appearance: { showDataLabels: true, colorPalette: 'vibrant', fillEmptyDates: true },
  leadFieldFilter: {
    fieldId: 'e4270e93-e9b9-4d9b-9589-d614ce335bcd',
    fieldName: 'MQL',
    selectedValues: ['SIM - Acima de 30k']
  }
}
```

### Arquivos modificados

1. **`src/components/insights/visual-builder/types.ts`**: Adicionar `chartOrientation` ao `VisualConfig`
2. **`src/hooks/useStackedVisualData.ts`**: Ajustar label de semana para numero da semana do ano
3. **`src/components/insights/visuals/ConfigurableChart.tsx`**: Usar `chartOrientation` do config quando disponivel
4. **Banco de dados**: Inserir visual "Qtde Leads MQL - Semana"
