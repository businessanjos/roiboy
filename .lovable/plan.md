

## Correção: Painel compartilhado mostrando vazio

### Problemas identificados

**1. Query falha silenciosamente** — A Edge Function ordena por `.order("position", { ascending: true })` (linha 2022), mas a tabela `insights_visuals` **não tem coluna `position`**. Isso causa um erro no Supabase que retorna `visuals = null`, e o frontend exibe "Este painel não possui visuais configurados."

**2. Dados empilhados nunca chegam ao frontend** — A Edge Function coloca TODOS os dados (stacked e não-stacked) no objeto `visualsData`. Mas o frontend espera:
- `visualsData[id]` → `AggregatedDataPoint[]` (array simples)  
- `stackedVisualsData[id]` → `{ data, seriesKeys }` (objeto com série)

Como a Edge Function nunca retorna `stackedVisualsData`, os visuais empilhados ficam sem dados.

### Solução

**Arquivo: `supabase/functions/shared-dashboard/index.ts`**

1. **Corrigir ordenação** — Trocar `.order("position", ...)` por `.order("created_at", { ascending: true })` (que é a ordenação usada no hook interno)

2. **Separar dados stacked** — No loop de computação (linhas 2033-2050), separar os resultados em dois objetos distintos:

```typescript
const visualsData: Record<string, AggregatedDataPoint[]> = {};
const stackedVisualsData: Record<string, StackedResult> = {};

for (const visual of visuals || []) {
  const isStacked = visual.chart_type === 'bar_stacked';
  if (isStacked) {
    // Resultado vai para stackedVisualsData
    stackedVisualsData[visual.id] = await compute...;
  } else {
    // Resultado vai para visualsData
    visualsData[visual.id] = await computeVisualData(...);
  }
}
```

3. **Incluir `stackedVisualsData` na resposta** — Adicionar ao JSON de retorno:
```typescript
{ status: "approved", dashboard, visuals, visualsData, stackedVisualsData, filterOptions }
```

### Arquivos alterados
- `supabase/functions/shared-dashboard/index.ts`

