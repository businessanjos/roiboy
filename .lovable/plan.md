

## Criar 3 visuais "Qtde Leads MQL" com granularidade Dia, Semana e Mes

### Objetivo

Adicionar ao painel "Leads" tres graficos de barras empilhadas que mostram a contagem de leads qualificados (MQL = "SIM - Acima de 30k"), segmentados pelo campo "Canal" (funil de origem), em tres granularidades temporais: dia, semana e mes.

### Implementacao

Sera criado um script de inicializacao (ou bloco de codigo direto) que insere os 3 visuais no dashboard ativo via a funcao `addVisual` do hook `useInsightsDashboards`. Cada visual tera a seguinte configuracao base:

- **Fonte de dados**: `leads`
- **Tipo de grafico**: `bar_stacked`
- **Medida**: Contagem (`aggregation: 'count'`)
- **Dimensao**: Campo `created_at` (tipo `date`) com agrupamento variando entre `day`, `week` e `month`
- **Empilhamento**: Campo `canal` (funil de origem do lead)
- **Filtro MQL**: Campo `e4270e93-e9b9-4d9b-9589-d614ce335bcd` com valor selecionado `SIM - Acima de 30k`

### Detalhes dos 3 visuais

| Visual | Titulo | Agrupamento | Layout (w x h) |
|--------|--------|-------------|-----------------|
| 1 | Qtde Leads MQL - Dia | day | 16 x 8 |
| 2 | Qtde Leads MQL - Semana | week | 16 x 8 |
| 3 | Qtde Leads MQL - Mes | month | 16 x 8 |

### Secao tecnica

Sera criado um componente utilitario (ou adicionada logica temporaria) que chama `addVisual` tres vezes com as configs abaixo. A abordagem mais limpa e criar uma pagina/botao auxiliar ou um script de seed, mas como o usuario quer os visuais criados diretamente, vou inserir via um efeito unico em um componente dedicado que executa uma vez e se auto-desativa.

**Alternativa escolhida**: Criar um componente `SeedMQLVisuals` que, ao ser montado, insere os 3 visuais no dashboard ativo e exibe um toast de confirmacao. Esse componente sera montado uma unica vez no `InsightsMainContent` condicionalmente, e removido apos uso.

Configuracao de cada visual:

```text
{
  dataSource: 'leads',
  measure: { field: '', aggregation: 'count' },
  dimension: { field: 'created_at', type: 'date', dateGrouping: 'day' | 'week' | 'month' },
  formatting: { type: 'decimal', decimals: 0 },
  appearance: { showDataLabels: true, dateDisplayFormat: 'short', colorPalette: 'default', fillEmptyDates: true },
  stackBy: 'canal',
  leadFieldFilter: {
    fieldId: 'e4270e93-e9b9-4d9b-9589-d614ce335bcd',
    fieldName: 'MQL',
    selectedValues: ['SIM - Acima de 30k']
  }
}
```

### Arquivos modificados

1. **`src/components/insights/SeedMQLVisuals.tsx`** (novo): Componente que insere os 3 visuais ao montar
2. **`src/components/insights/InsightsMainContent.tsx`**: Monta o `SeedMQLVisuals` uma unica vez, depois removemos o componente

Apos a criacao dos visuais, o componente de seed sera removido do codigo para manter a base limpa.
