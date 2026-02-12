

## Adicionar metrica "Ciclo de Vendas" ao Scorecard

### O que sera feito

Adicionar uma nova opcao de metrica chamada **"Ciclo de Vendas"** na lista de metricas do modal "Adicionar Visual" (Passo 2). Essa metrica calcula a media de dias entre a "Data do primeiro contato" (campo customizado em `deal_field_values`, ID `166fe351-b29b-4f08-b330-88f82c65f625`) e a data em que o negocio foi ganho (`won_at`).

### Calculo

Para cada negocio com status "won" que possua ambos `won_at` e `value_date` (primeiro contato) preenchidos:
- Diferenca em dias = `won_at - value_date`
- Resultado final = media aritmetica dessas diferencas

O scorecard exibira o valor em dias (ex: "15 dias") com a contagem de negocios usados no calculo.

### Arquivos afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/AddVisualModal.tsx` | Adicionar `sales_cycle` ao tipo `Metric`, ao array `METRICS`, ao mapeamento `METRIC_TO_CONFIG` e ao `METRIC_LABELS` |
| `src/hooks/useVisualData.ts` | Adicionar tratamento especial para `aggregation: 'sales_cycle'` dentro do `fetchDealsData`, criando uma funcao dedicada que busca negocios ganhos + campo primeiro contato e calcula a media de dias |
| `src/components/insights/visual-builder/types.ts` | Adicionar `'sales_cycle'` ao tipo `Aggregation` e ao array `AGGREGATION_OPTIONS` |

### Detalhes tecnicos

**1. AddVisualModal.tsx**
- Nova entrada em `METRICS`:
  - `{ value: "sales_cycle", label: "Ciclo de Vendas", description: "Media de dias entre primeiro contato e fechamento" }`
- Nova entrada em `METRIC_TO_CONFIG`:
  - `sales_cycle: { dataSource: 'deals', measureField: null, aggregation: 'sales_cycle', formatType: 'decimal', statusFilter: 'won' }`
- Nova entrada em `METRIC_LABELS`:
  - `sales_cycle: "Ciclo de Vendas"`

**2. useVisualData.ts**
- No `fetchDealsData`, antes da query principal, detectar `measure.aggregation === 'sales_cycle'` e chamar uma funcao dedicada `calculateSalesCycle`
- Essa funcao:
  1. Busca negocios ganhos (`status = 'won'`, `won_at IS NOT NULL`) no periodo filtrado (usando `won_at` como campo de data)
  2. Busca os `deal_field_values` com `field_id = '166fe351-...'` para esses negocios
  3. Para cada negocio com ambas as datas, calcula a diferenca em dias
  4. Retorna a media como `value` e a contagem como `count`
  5. Formata o sufixo " dias" no display

**3. types.ts**
- Adicionar `'sales_cycle'` ao union type `Aggregation`
- Adicionar ao array `AGGREGATION_OPTIONS`: `{ value: 'sales_cycle', label: 'Ciclo de Vendas' }`

### Formato de exibicao

O scorecard exibira algo como:
- **"15"** (valor principal, com formato decimal e 0 casas)
- **"23 registros"** (contagem de negocios usados)
- O titulo auto-gerado sera "Ciclo de Vendas"
- Tambem suportara agrupamento por vendedor, mes, etc. nos graficos de barra/linha

