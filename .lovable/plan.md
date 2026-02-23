
## Suportar fonte de dados "Leads" no grafico de Barras Empilhadas

### Problema

O hook `useStackedVisualData` so possui a funcao `fetchStackedDealsData`, que sempre consulta a tabela `deals`. Quando o visual "Leads por Canal" e criado com tipo `bar_stacked` e `dataSource: 'leads'`, o sistema tenta buscar o campo `canal` na tabela `deals` (que nao existe la), resultando em erro e "Sem dados para exibir".

### Solucao

Adicionar uma funcao `fetchStackedLeadsData` ao hook `useStackedVisualData.ts` e rotear a chamada com base no `dataSource` da config.

### Alteracoes

#### `src/hooks/useStackedVisualData.ts`

1. **Rotear por dataSource no queryFn (linha 31):** Em vez de sempre chamar `fetchStackedDealsData`, verificar `config.dataSource`:
   - Se `'leads'`, chamar `fetchStackedLeadsData`
   - Se `'deals'`, chamar `fetchStackedDealsData` (comportamento atual)

2. **Criar funcao `fetchStackedLeadsData`:**
   - Consultar a tabela `leads` com campos `id, status, source, canal, created_at`
   - Filtrar por `account_id` e `converted_to_client_id is null`
   - Aplicar filtros de data usando `created_at`
   - Aplicar filtro de lead field se configurado
   - Agrupar por campo da dimensao (ex: `canal`) como eixo X
   - Empilhar por `stackBy` (ex: `status` com valores Aberto/Ganho/Perdido)
   - Retornar `{ data: StackedDataPoint[], seriesKeys: string[] }` no mesmo formato do deals

3. **Logica de agrupamento:**
   - A dimensao do visual determina o eixo X (ex: `canal` = cada barra e um canal)
   - O `stackBy` determina as series empilhadas (ex: `status` = cores diferentes por status)
   - Para leads, a agregacao sera sempre `count`
   - Diferente do deals (que agrupa por periodo temporal e empilha por vendedor), leads agrupara por campo categorico (canal, origem, etc.)

### Resultado esperado

O visual "Leads por Canal" exibira barras horizontais empilhadas onde cada barra representa um canal (Trafego Pago, Organico, Recorrencia, etc.) e as cores dentro de cada barra representam os status (Aberto, Ganho, Perdido) -- identico ao exemplo mostrado na segunda imagem.
