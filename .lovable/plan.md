

## Adicionar visual tipo "Conta-Giro" (Gauge) nos Insights

### Descricao

Dois novos subtipos de visual gauge para o setor de Vendas:

1. **Dias Corridos** -- exibe quantos dias do mes atual ja passaram vs. total de dias do mes. Calculo automatico, sem necessidade de dados do banco.
2. **Faturamento x Meta** -- exibe quanto da meta mensal foi atingido. A meta de cada mes e configuravel manualmente na edicao do visual.

Ambos renderizam um velocimetro (gauge) com faixas coloridas verde/amarelo/laranja/vermelho, ponteiro e percentual.

---

### Mudancas tecnicas

#### 1. Tipos (`src/components/insights/visual-builder/types.ts`)

- Adicionar `'gauge'` ao tipo `ChartType`
- Adicionar `'gauge'` ao array `CHART_TYPE_OPTIONS` com label "Conta-Giro"
- Adicionar campo opcional `gaugeConfig` na interface `VisualConfig`:

```text
gaugeConfig?: {
  subType: 'days_elapsed' | 'revenue_vs_goal';
  monthlyGoals?: Record<string, number>; // chave "YYYY-MM", valor meta em R$
};
```

#### 2. Componente Gauge SVG (`src/components/insights/visuals/ConfigurableGauge.tsx`)

Novo componente que renderiza um velocimetro usando SVG puro:
- Arco semicircular com 3-4 faixas de cor (verde, amarelo, laranja, vermelho)
- Ponteiro (needle) apontando para o valor atual
- Circulo central decorativo
- Exibe valor numerico no centro e percentual abaixo
- Props: `value`, `min`, `max`, `label`, `formatValue`

Logica por subtipo:
- **days_elapsed**: `value = dia atual`, `max = total dias do mes`, calculo local com `new Date()`
- **revenue_vs_goal**: `value = soma dos deals ganhos no mes` (vem do `useVisualData`), `max = meta do mes` (do `gaugeConfig.monthlyGoals`)

#### 3. Roteamento no ConfigurableChart (`src/components/insights/visuals/ConfigurableChart.tsx`)

Adicionar case `'gauge'` no switch que delega para `ConfigurableGauge`, passando `data`, `formatting` e `visualConfig`.

#### 4. Roteamento no ConfigurableVisualCard (`src/components/insights/visuals/ConfigurableVisualCard.tsx`)

O gauge de "Dias Corridos" nao precisa de dados do banco. Quando `gaugeConfig.subType === 'days_elapsed'`, o card renderiza o gauge diretamente sem depender do `useVisualData`.

#### 5. Selecao no VisualBuilderSheet (`src/components/insights/visual-builder/VisualBuilderSheet.tsx`)

Quando o chart type selecionado for `'gauge'`:
- Exibir selector de subtipo (Dias Corridos / Faturamento x Meta)
- Para "Dias Corridos": nao exigir data source, measure ou dimension (auto-calculado)
- Para "Faturamento x Meta": exigir data source = deals, e exibir campo para inserir a meta do mes atual

#### 6. Edicao de metas no VisualQuickSettings (`src/components/insights/visuals/VisualQuickSettings.tsx`)

Quando o visual for gauge de `revenue_vs_goal`:
- Exibir secao "Metas Mensais" com campos para editar a meta de cada mes
- Interface com lista dos proximos/ultimos meses, cada um com um input numerico para definir a meta em R$
- As metas sao salvas no campo `gaugeConfig.monthlyGoals` do JSON `config` no banco

#### 7. Icone no ChartTypeSelector (`src/components/insights/visual-builder/ChartTypeSelector.tsx`)

Adicionar icone `Gauge` (lucide-react) mapeado ao tipo `'gauge'`.

#### 8. Export no index (`src/components/insights/visuals/index.ts`)

Exportar o novo `ConfigurableGauge`.

---

### Estrutura do SVG do Gauge

```text
         Faixas coloridas (arco 180 graus)
        Verde | Amarelo | Laranja | Vermelho

              Ponteiro (needle)
                   |
              [ valor ]
              [ X.XX% ]
```

- Faixas: 0-25% verde, 25-50% amarelo, 50-75% laranja, 75-100% vermelho
- Para "Dias Corridos": invertido (verde no inicio = poucos dias passaram, vermelho no final = mes acabando)
- Para "Faturamento x Meta": verde quando proximo da meta, vermelho quando longe

---

### Persistencia

Nenhuma alteracao no schema do banco e necessaria. As metas mensais sao armazenadas no campo JSON `config` da tabela `insights_visuals`, dentro de `gaugeConfig.monthlyGoals`.

