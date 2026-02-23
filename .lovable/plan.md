

## Adicionar suporte a "Faturamento Atual" no visual de Leads empilhado

### Problema

O campo "Faturamento Atual" e um campo personalizado armazenado na tabela `lead_field_values`, nao uma coluna nativa da tabela `leads`. O hook `useVisualData` (graficos simples) ja possui a logica de enriquecimento via `enrichLeadsWithFaturamento`, porem o hook `useStackedVisualData` (graficos empilhados) nao faz esse enriquecimento. Quando o visual usa `faturamento_atual` como dimensao, o codigo tenta ler `lead.faturamento_atual` diretamente, que nao existe, e tudo cai em "Nao informado".

### Alteracao

#### `src/hooks/useStackedVisualData.ts` -- funcao `fetchStackedLeadsData`

Apos buscar todos os leads e aplicar os filtros (linha ~252), adicionar a logica de enriquecimento quando `dimensionField` ou `stackByField` forem `faturamento_atual` ou `mql`:

1. Importar as funcoes `enrichLeadsWithFaturamento` e `enrichLeadsWithMql` de `useVisualData.ts` (ou replicar a logica inline, dependendo de como estao exportadas).

2. Antes do loop de agrupamento (linha 258), verificar:
   - Se `dimensionField === 'faturamento_atual'` ou `stackByField === 'faturamento_atual'`, chamar `enrichLeadsWithFaturamento` para injetar a propriedade `faturamento_atual` em cada lead.
   - Se `dimensionField === 'mql'` ou `stackByField === 'mql'`, chamar `enrichLeadsWithMql` para injetar `_mql_label`.

3. Ajustar o mapeamento de valor na linha 259 para usar `_mql_label` quando o campo for `mql` (consistente com `useVisualData`).

### Secao tecnica

A funcao `enrichLeadsWithFaturamento` busca os valores do campo `e352a1ca-cfbc-435a-95f7-2f53b5cac041` na tabela `lead_field_values` e injeta `faturamento_atual` em cada lead. Atualmente essa funcao esta definida em `useVisualData.ts`. Para reutiliza-la:

- Exportar `enrichLeadsWithFaturamento` e `enrichLeadsWithMql` de `useVisualData.ts`
- Importar em `useStackedVisualData.ts`
- Chamar antes do agrupamento

```text
fetchStackedLeadsData:
  1. Buscar leads (existente)
  2. Aplicar filtros (existente)
  3. [NOVO] Se dimensionField ou stackByField == 'faturamento_atual':
       allLeads = await enrichLeadsWithFaturamento(accountId, allLeads)
  4. [NOVO] Se dimensionField ou stackByField == 'mql':
       allLeads = await enrichLeadsWithMql(accountId, allLeads)
  5. [AJUSTE] Na leitura do valor do campo mql, usar lead._mql_label
  6. Agrupar e retornar (existente)
```

### Resultado

- O visual "Leads por Faturamento Atual" exibira as categorias reais (ex: "Entre 20 e 30 mil reais", "Acima de 50 mil reais") em vez de "Nao informado"
- A mesma logica se aplica a qualquer visual empilhado que use campos personalizados como dimensao
