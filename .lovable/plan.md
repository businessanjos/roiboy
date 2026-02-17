

## Adicionar "Meta" ao Scorecard e corrigir filtro do Gauge "Faturamento x Meta"

### Problema atual

1. O Gauge "Faturamento x Meta" sempre usa o mes corrente para buscar a meta (hardcoded `new Date()`), ignorando os filtros de data da pagina. Quando o filtro e "Este Ano", ele mostra o faturamento do ano inteiro mas a meta de apenas 1 mes.
2. O Scorecard nao possui opcao de exibir "Meta" como metrica.

### Mudancas

#### 1. Passar filtros de data para o Gauge (`ConfigurableGauge.tsx`)

- Importar `useInsightsFilters` no `RevenueVsGoalGauge`
- Em vez de usar `new Date()` para pegar a meta de 1 mes, analisar o range de datas do filtro ativo:
  - Se o filtro cobre apenas 1 mes: exibir a meta daquele mes
  - Se o filtro cobre multiplos meses (ex: ano inteiro): somar as metas de todos os meses dentro do range
- A meta (max do gauge) passa a ser a soma das metas dos meses no periodo filtrado
- Atualizar sublabel para refletir o periodo

#### 2. Adicionar metrica "Meta" no modal de criacao (`AddVisualModal.tsx`)

- Adicionar nova opcao na lista de metricas do Scorecard: `{ value: "meta", label: "Meta", description: "Meta de faturamento configurada" }`
- Quando `metric === 'meta'` e `chartType === 'scorecard'`:
  - Exibir campo para inserir a meta do mes atual (igual ao gauge)
  - Salvar `monthlyGoals` dentro de `gaugeConfig` no config do scorecard

#### 3. Renderizar scorecard de "Meta" (`ConfigurableScorecard.tsx`)

- Verificar se `config?.gaugeConfig?.monthlyGoals` existe
- Importar `useInsightsFilters` para ler o range de datas ativo
- Calcular a meta baseada no filtro:
  - Filtro de 1 mes: exibir meta daquele mes
  - Filtro de ano/trimestre: somar metas dos meses cobertos
- Exibir o valor formatado como currency

#### 4. Editor de metas no VisualQuickSettings (`VisualQuickSettings.tsx`)

- Estender a condicao `isGaugeRevenue` para incluir tambem scorecards com `gaugeConfig.monthlyGoals`
- Assim o editor de metas mensais aparece tambem para scorecards de "Meta"

#### 5. Tipos (`types.ts`)

Nenhuma mudanca necessaria -- `gaugeConfig` ja existe no `VisualConfig` e pode ser reutilizado pelo scorecard.

---

### Logica de calculo da meta por filtro

```text
filtro startDate / endDate
  |
  v
Extrair meses cobertos (ex: 2026-01 ate 2026-12)
  |
  v
Somar monthlyGoals[mes] para cada mes no range
  |
  v
Resultado = meta total do periodo
```

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `ConfigurableGauge.tsx` | Usar filtros de data para calcular meta do periodo |
| `ConfigurableScorecard.tsx` | Suportar exibicao de meta com filtros |
| `AddVisualModal.tsx` | Nova metrica "Meta" para scorecard |
| `VisualQuickSettings.tsx` | Exibir editor de metas para scorecards de meta |

