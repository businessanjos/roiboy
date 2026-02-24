

## Corrigir visual "Faturamento por Canal" para Negocios (Deals)

### Diagnostico

O visual "Faturamento por Canal" esta configurado com `dataSource: deals` e `dimension.field: canal`. Porem:

1. A tabela `deals` **nao possui** coluna `canal` -- apenas a tabela `leads` possui
2. O campo "Canal" mostrado no perfil do Lead (ex: "Organico") e um **campo personalizado** do Lead (ID: `3bcdcf47...`)
3. Para Negocios, existe um campo personalizado separado chamado **"Canal de Venda"** (ID: `16ebda9f...`, `show_in_deals: true`) que ja possui 597 registros preenchidos (organico, trafego_pago, indicacao, etc.)
4. O codigo em `getGroupKey` tenta ler `item.canal`, que e sempre `undefined` para deals, resultando em tudo agrupado como "Nao Informado"

### Solucao

Enriquecer os deals com o campo personalizado "Canal de Venda" quando a dimensao `canal` for solicitada, similar ao que ja e feito para MQL.

#### 1. `src/hooks/useVisualData.ts` - Adicionar enriquecimento de Canal de Venda

- Criar constante `DEAL_CANAL_FIELD_ID = '16ebda9f-cd3b-412c-bb06-0950001963c5'`
- Criar mapa de opcoes para traduzir chaves (`organico`, `trafego_pago`, etc.) para labels amigaveis (`Organico`, `Trafego Pago`, etc.)
- Criar funcao `enrichDealsWithCanal(accountId, deals)` que:
  - Busca valores do campo "Canal de Venda" na tabela `deal_field_values`
  - Mapeia cada deal com `deal.canal = label correspondente`
- Na funcao `fetchDealsData`, antes de chamar `aggregateData`, adicionar verificacao: se `dimension.field === 'canal'`, enriquecer os deals com `enrichDealsWithCanal`

#### 2. `src/components/insights/visual-builder/types.ts` - Adicionar "Canal" como dimensao de Deals

- Adicionar `{ value: 'canal', label: 'Canal', type: 'text' }` ao array `deals.dimension` para que novos visuais possam ser criados com essa dimensao

#### 3. `src/hooks/useStackedVisualData.ts` - Suportar canal no stacked

- Na funcao `fetchStackedDealsData`, adicionar o mesmo enriquecimento quando `stackBy === 'canal'` ou `dimension.field === 'canal'` para que graficos empilhados tambem funcionem

### Detalhe tecnico do mapeamento

O campo "Canal de Venda" possui estas opcoes:
```text
organico       -> Organico
trafego_pago   -> Trafego Pago
indicacao      -> Indicacao
prospeccao_ativa -> Prospeccao Ativa
eventos        -> Trafego Alheio
carteira_esteira -> Carteira / Esteira
social_seller  -> Social Seller
recorrencia    -> Recorrencia
```

O sistema buscara as opcoes do campo diretamente da tabela `custom_fields` para manter a consistencia com configuracoes futuras.

### Resultado esperado

- O visual "Faturamento por Canal" exibira barras separadas por canal (Organico, Trafego Pago, etc.) com os valores corretos
- Novos visuais de deals poderao ser agrupados por Canal
- O visual existente funcionara sem necessidade de reconfiguracao

