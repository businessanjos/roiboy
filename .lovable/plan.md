

## Adicionar agrupamento "Por MQL" no visual de grafico de pizza

### O que sera feito

Adicionar uma nova opcao de agrupamento "Por MQL" no passo 3 da criacao de visuais (graficos de barras, linhas e pizza). Os dados serao agrupados com base no campo personalizado MQL dos negocios, que possui duas opcoes: "SIM - Acima de 30k" e "NAO - Abaixo de 30k".

### Como vai funcionar

1. Na tela de "Como agrupar os dados?" (passo 3), aparecera uma nova opcao "Por MQL"
2. Ao selecionar, o visual agrupara os negocios pela classificacao MQL
3. Negocios sem MQL preenchido aparecerao como "Nao informado"
4. As cores das opcoes (verde para SIM, vermelho para NAO) serao aplicadas automaticamente no grafico

### Mudancas tecnicas

**1. Arquivo: `src/components/insights/AddVisualModal.tsx`**

- Adicionar `'mql'` ao tipo `GroupBy`
- Adicionar entrada no array `GROUP_BY_OPTIONS`:
  - value: `'mql'`, label: "Por MQL", description: "Classificacao MQL do negocio"
- Adicionar mapeamento em `GROUP_BY_TO_DIMENSION`:
  - `mql: { field: 'mql', type: 'text' }`
- Adicionar label "por MQL" em `GROUP_LABELS`

**2. Arquivo: `src/hooks/useVisualData.ts`**

- Modificar `fetchDealsData` para incluir dados de MQL quando `dimension.field === 'mql'`
- Fazer uma query separada na tabela `deal_field_values` com `field_id = '448404cd-0344-4892-a574-2387b1c17578'` para obter o valor MQL de cada deal
- Fazer join dos dados em memoria (deal_id -> valor MQL)
- Mapear os valores internos (`sim_acima_30k`, `nao_abaixo_30k`) para os labels legíveis ("SIM - Acima de 30k", "NAO - Abaixo de 30k")
- Aplicar as cores correspondentes (verde para SIM, vermelho para NAO)
- Modificar `getGroupKey` para tratar `dimension.field === 'mql'` retornando o label MQL do deal
- Modificar `getGroupColor` para retornar a cor MQL

### Fluxo de dados

A busca de MQL sera feita em paralelo com a busca de deals:

```text
1. Buscar deals (query existente)
2. Buscar deal_field_values WHERE field_id = MQL_FIELD_ID (query nova)
3. Criar mapa: deal_id -> { label, color }
4. Injetar campo '_mql_label' e '_mql_color' em cada deal
5. Agrupar normalmente usando aggregateData
```

### Mapeamento de valores

```text
Valor interno          -> Label exibido          -> Cor
sim_acima_30k          -> SIM - Acima de 30k     -> #22c55e (verde)
nao_abaixo_30k         -> NAO - Abaixo de 30k    -> #ef4444 (vermelho)
null/vazio             -> Nao informado          -> (sem cor)
```

