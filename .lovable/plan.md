

## Adicionar barra de filtros ao painel compartilhado

### Contexto

O painel compartilhado (link publico) atualmente mostra todos os dados sem possibilidade de filtragem. O painel interno do sistema possui uma barra de filtros com presets de data (Hoje, Esta Semana, Este Mes, etc.), filtro por vendedor e filtro por produto. Essa mesma capacidade precisa ser replicada na visualizacao publica.

### Desafio tecnico

O componente `InsightsFilterBar` existente depende de:
- `useInsightsFilters` (Context Provider que nao existe na rota publica)
- `useQuery` com `supabase` direto (requer autenticacao/RLS)

Portanto, nao e possivel reutilizar o componente diretamente. A solucao e:
1. Retornar as opcoes de filtro (vendedores e produtos) junto com os dados do edge function
2. Criar uma barra de filtros local no `SharedInsightsDashboard`
3. Re-buscar dados do edge function quando os filtros mudam

### Alteracoes

#### 1. Edge Function `supabase/functions/shared-dashboard/index.ts`

**Aceitar parametros de filtro no GET:**
- `startDate` e `endDate` (ISO strings)
- `userId` (UUID ou "all")
- `productId` (UUID ou "all")

**Retornar opcoes de filtro:**
- Buscar vendedores unicos da tabela `users` com `account_id`
- Buscar produtos ativos da tabela `products` com `account_id`
- Incluir no response: `filterOptions: { users: [{id, name}], products: [{id, name}] }`

**Aplicar filtros nas queries:**
- Em `computeDealsData` e `computeStackedVisualData`: filtrar por intervalo de data e por `responsible_user_id`
- Em `computeLeadsData`: filtrar por intervalo de data
- Em `computeProductsData`: filtrar conforme aplicavel

#### 2. Frontend `src/pages/SharedInsightsDashboard.tsx`

**Estado local de filtros:**
- `sharedFilters`: objeto com `preset`, `startDate`, `endDate`, `userId`, `productId`
- Funcoes auxiliares para calcular datas a partir de presets (replicando a logica de `useInsightsFilters`)

**Componente de filtro inline:**
- Renderizar uma barra de filtros similar a `InsightsFilterBar` diretamente no componente
- Dropdown de presets de data (Hoje, Esta Semana, Este Mes, Mes Passado, Este Trimestre, Este Ano, Personalizado)
- Dropdown de vendedores (populado com dados do edge function)
- Dropdown de produtos (populado com dados do edge function)

**Re-fetch ao mudar filtros:**
- Quando qualquer filtro mudar, chamar o edge function novamente com os novos parametros
- Mostrar indicador de loading durante o re-fetch
- Atualizar `visualsData` e `stackedVisualsData` com os novos resultados

### Fluxo de dados

1. Primeiro GET (acesso aprovado) retorna dados com filtros padrao (ano atual) + opcoes de filtro
2. Usuario altera filtro na barra
3. Novo GET com parametros de filtro envia request ao edge function
4. Edge function computa dados filtrados e retorna
5. Frontend atualiza os visuais com os novos dados

### Resultado esperado

Visitantes com acesso aprovado verao uma barra de filtros abaixo do titulo do painel, identica visualmente a do sistema interno, permitindo alterar periodo, vendedor e produto. Os visuais serao recalculados server-side a cada mudanca de filtro.

