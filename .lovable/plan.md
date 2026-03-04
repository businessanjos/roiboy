

## Problema: Funil perde etapas ao filtrar por período

### Causa raiz

No `useVisualData.ts`, o funil de vendas (`chartType === 'funnel'`, `dimension.field === 'stage_name'`) busca deals filtrados por `created_at` no período selecionado. A função `aggregateData` só cria entradas para etapas que têm pelo menos 1 deal no resultado. **Etapas sem deals no período simplesmente desaparecem do funil.**

Exemplo: se no mês atual só existem deals nas etapas "Oportunidade", "Diagnóstico" e "Contrato", as etapas "Prospecção" e "Proposta" somem completamente — mesmo que deals ganhos tenham obrigatoriamente passado por elas.

### Solução

Após a agregação e ordenação por `display_order`, garantir que **todas as etapas do pipeline** apareçam no funil, preenchendo com `value: 0` as que não tiveram deals no período.

### Alteração — `src/hooks/useVisualData.ts` (linhas ~76-89)

Após o sort por `display_order`, inserir lógica que:

1. Compara as etapas retornadas com a lista completa de `deal_stages` (que já foi buscada na linha 78)
2. Para cada etapa do pipeline que não está no resultado, insere um `AggregatedDataPoint` com `value: 0` na posição correta
3. Preserva a cor da etapa vinda de `deal_stages`

```typescript
// After sorting by display_order (line 88)
if (stages && stages.length > 0) {
  const orderMap = new Map(stages.map(s => [s.name, s.display_order]));
  result.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));

  // Ensure ALL pipeline stages appear, even with 0 deals
  const existingNames = new Set(result.map(r => r.name));
  const stageColors = await supabase
    .from('deal_stages')
    .select('name, color')
    .eq('account_id', currentUser.account_id);
  
  const colorMap = new Map((stageColors.data || []).map(s => [s.name, s.color]));
  
  for (const stage of stages) {
    if (!existingNames.has(stage.name)) {
      result.push({
        name: stage.name,
        value: 0,
        count: 0,
        color: colorMap.get(stage.name) || '#6366f1',
      });
    }
  }
  // Re-sort after adding missing stages
  result.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));
}
```

Otimização: como já temos o `stages` da query anterior (linha 78), podemos buscar `color` na mesma query original, evitando uma query extra. Basta alterar o select de `'name, display_order'` para `'name, display_order, color'`.

### Resultado esperado

- Todas as etapas do pipeline sempre aparecem no funil, independentemente do filtro de data
- Etapas sem deals no período aparecem com valor 0, mantendo a visualização completa do funil
- A etapa "Ganhos" continua sendo adicionada ao final como já é feito

