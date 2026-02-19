

## Corrigir tela branca no painel compartilhado

### Problema

Quando o acesso e aprovado, a pagina compartilhada tenta renderizar o componente `ConfigurableVisualCard`, que internamente chama `useCurrentUser()`. Como a pagina compartilhada nao tem autenticacao (nao tem `CurrentUserProvider`), o hook lanca um erro e toda a pagina quebra com tela branca.

Alem disso, mesmo que o provider existisse, o visitante nao esta autenticado no sistema, entao as queries diretas ao banco seriam bloqueadas pelas politicas de seguranca (RLS).

### Causa raiz

A cadeia de dependencias e:
```text
SharedInsightsDashboard
  -> InsightsGrid
    -> ConfigurableVisualCard
      -> useVisualData()
        -> useCurrentUser()  // ERRO: sem CurrentUserProvider
```

### Solucao

Criar um componente simplificado `SharedVisualCard` que recebe dados pre-computados da edge function em vez de buscar do banco. A edge function `shared-dashboard` sera atualizada para computar os dados de cada visual no servidor (usando service role, que ignora RLS).

### Alteracoes

**1. Edge Function `supabase/functions/shared-dashboard/index.ts`**

Quando o status e "approved", alem de retornar os visuais, tambem computar os dados de cada visual no servidor. Para cada visual, executar a query correspondente (deals, leads, etc.) usando o `supabaseAdmin` e retornar os resultados agregados junto com o visual:

- Adicionar uma funcao `computeVisualData(supabaseAdmin, visual, accountId)` que replica a logica basica de agregacao do `useVisualData`
- No response de "approved", incluir um campo `visualsData` com os dados pre-computados: `{ [visualId]: dataPoints[] }`

**2. Novo componente `src/components/insights/visuals/SharedVisualCard.tsx`**

Criar um componente leve que:
- Recebe o visual config E os dados pre-computados como props
- Renderiza o `ConfigurableChart` diretamente com os dados (sem hooks de fetch)
- Nao usa `useCurrentUser` nem `useVisualData`
- E somente leitura (sem drilldown, sem settings)

**3. Atualizar `src/pages/SharedInsightsDashboard.tsx`**

- Armazenar `visualsData` retornado pela edge function
- Renderizar um grid customizado com `SharedVisualCard` em vez de `InsightsGrid` + `ConfigurableVisualCard`
- Usar `react-grid-layout` diretamente para posicionar os cards conforme o layout salvo

### Detalhes tecnicos da edge function

A funcao `computeVisualData` tera logica simplificada para os data sources principais:

```typescript
async function computeVisualData(supabase, visual, accountId) {
  const config = visual.config;
  if (!config) return [];
  
  switch (config.dataSource) {
    case 'deals': {
      let query = supabase.from('deals').select('value, status, created_at, ...')
        .eq('account_id', accountId);
      // Apply statusFilter, date filters from config
      // Aggregate by dimension
      // Return [{name, value, count}]
    }
    case 'leads': { ... }
    case 'products': { ... }
    default: return [];
  }
}
```

Para a primeira versao, focaremos nos data sources `deals` (o mais usado), com agregacoes basicas (count, sum). Visuais com data sources nao suportados mostrarao uma mensagem "Dados indisponiveis na visualizacao compartilhada".

### Resultado esperado

Ao acessar o link compartilhado apos aprovacao, o visitante vera os graficos do painel com dados reais, renderizados a partir de dados computados no servidor, sem necessidade de autenticacao no cliente.
