

## Scorecard de Lead - Contagem Total de Leads

### O que sera feito

Adicionar uma nova opcao de metrica no fluxo de criacao de Scorecard chamada **"Total de Leads"**, que exibira a contagem total de todos os leads cadastrados.

### Mudancas tecnicas

**1. Arquivo: `src/components/insights/AddVisualModal.tsx`**

- Adicionar novo tipo de metrica `'leads_count'` ao tipo `Metric`
- Adicionar entrada no array `METRICS` com label "Total de Leads" e descricao "Contagem de todos os leads cadastrados"
- Adicionar mapeamento em `METRIC_TO_CONFIG` para `leads_count`:
  - `dataSource: 'leads'`
  - `measureField: null`
  - `aggregation: 'count'`
  - `formatType: 'decimal'`
- Adicionar label "Leads" em `METRIC_LABELS`
- Garantir que quando `metric === 'leads_count'` e `chartType === 'scorecard'`, o fluxo funcione em 2 passos (ja funciona pois scorecards sao sempre 2 passos)

**2. Arquivo: `src/hooks/useVisualData.ts`**

- Verificar que o case `'leads'` ja suporta `aggregation: 'count'` com `dimension._total` (provavelmente ja suporta pela funcao `fetchLeadsData` existente, mas precisa validar)
- Se necessario, ajustar para que contagem total funcione quando dimension.field === '_total'

### Resultado esperado

Na lista de metricas do scorecard (passo 2), aparecera uma nova opcao "Total de Leads" apos as opcoes existentes. Ao selecionar, criara um scorecard que mostra o numero total de leads cadastrados na conta.
