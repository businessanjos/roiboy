
## Corrigir tela branca no painel compartilhado (2 erros de contexto)

### Problema identificado

O erro no console e claro:
```
Error: useInsightsFilters must be used within InsightsFiltersProvider
```

O componente `SharedVisualCard` renderiza `ConfigurableChart`, que por sua vez renderiza sub-componentes como `ConfigurableScorecard` e `ConfigurableGauge` (RevenueVsGoalGauge). Esses dois componentes chamam `useInsightsFilters()`, que exige o `InsightsFiltersProvider` na arvore de componentes. Na pagina compartilhada, esse provider nao existe, causando o crash e a tela branca.

### Cadeia de erro

```text
SharedVisualCard
  -> ConfigurableChart
    -> ConfigurableScorecard -> useInsightsFilters() -> CRASH
    -> ConfigurableGauge (RevenueVsGoalGauge) -> useInsightsFilters() -> CRASH
```

### Solucao

Duas abordagens complementares para resolver de forma robusta:

**1. Proteger o `SharedVisualCard` com Error Boundary**

Envolver o conteudo do `SharedVisualCard` com um React Error Boundary para que, se qualquer sub-componente falhar, o card exiba uma mensagem amigavel em vez de derrubar toda a pagina.

**2. Tornar `useInsightsFilters` seguro fora do provider**

Modificar o hook `useInsightsFilters` para retornar valores padrao quando usado fora do provider, em vez de lancar um erro. Isso e a correcao principal:

- No arquivo `src/hooks/useInsightsFilters.tsx`, alterar a funcao `useInsightsFilters` para verificar se o contexto existe e, caso nao exista, retornar um objeto com filtros padrao (datas do ano atual, sem filtros de usuario/estagio) em vez de lancar `throw new Error(...)`.

### Detalhes tecnicos

**Arquivo `src/hooks/useInsightsFilters.tsx`** (alteracao principal):

Alterar de:
```typescript
export function useInsightsFilters() {
  const ctx = useContext(InsightsFiltersContext);
  if (!ctx) throw new Error("useInsightsFilters must be used within InsightsFiltersProvider");
  return ctx;
}
```

Para:
```typescript
const defaultFilters = {
  startDate: new Date(new Date().getFullYear(), 0, 1),
  endDate: new Date(new Date().getFullYear(), 11, 31),
  userId: null,
  stageId: null,
};

const defaultContext = {
  filters: defaultFilters,
  setFilters: () => {},
  // ... outros campos com valores neutros
};

export function useInsightsFilters() {
  const ctx = useContext(InsightsFiltersContext);
  if (!ctx) return defaultContext;
  return ctx;
}
```

**Arquivo `src/components/insights/visuals/SharedVisualCard.tsx`**:

Adicionar um Error Boundary simples ao redor do `ConfigurableChart` como camada extra de protecao, garantindo que visuais que falhem por qualquer motivo nao derrubem toda a pagina.

### Resultado esperado

- Visuais do tipo scorecard, gauge e demais renderizarao corretamente na pagina compartilhada usando filtros padrao (ano atual)
- Se algum visual individual falhar, apenas aquele card mostrara mensagem de erro, sem derrubar a pagina inteira
- Nenhuma alteracao necessaria na edge function (os dados ja estao sendo computados corretamente no servidor)
