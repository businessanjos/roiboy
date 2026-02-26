

## Adicionar Visual de Funil ao Dashboard de Insights

### Resumo

Adicionar um novo tipo de visualizacao "Funil" ao sistema de Insights, que exibe barras horizontais decrescentes representando a progressao sequencial de itens atraves de etapas ordenadas. O funil mostra quantos itens passaram por cada etapa e a taxa de conversao entre etapas consecutivas.

### Como funciona

O funil recebe os mesmos dados agregados que outros graficos (`AggregatedDataPoint[]`), mas os renderiza como barras horizontais centralizadas, cada uma menor que a anterior, com percentuais de conversao entre etapas. Para negocios agrupados por etapa (`stage_name`), as barras sao ordenadas pelo `display_order` da etapa no pipeline. Para outras dimensoes, os dados sao exibidos na ordem decrescente de valor.

### Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/insights/visual-builder/types.ts` | Adicionar `'funnel'` ao tipo `ChartType` e ao array `CHART_TYPE_OPTIONS` |
| `src/components/insights/visual-builder/ChartTypeSelector.tsx` | Adicionar icone do funil ao `ICON_MAP` |
| `src/components/insights/visuals/ConfigurableFunnel.tsx` | **Novo** - Componente de renderizacao do funil |
| `src/components/insights/visuals/ConfigurableChart.tsx` | Adicionar case `'funnel'` ao switch de renderizacao |
| `src/components/insights/visuals/index.ts` | Exportar `ConfigurableFunnel` |
| `src/components/insights/AddVisualModal.tsx` | Adicionar "Funil" como opcao de chart type e configurar fluxo de criacao |
| `src/hooks/useVisualData.ts` | Para funil com `stage_name`, buscar `display_order` das etapas e ordenar dados pela ordem do pipeline |

### Detalhes tecnicos

**1. Tipo `ChartType` (types.ts)**
- Adicionar `'funnel'` ao union type
- Adicionar `{ value: 'funnel', label: 'Funil' }` ao array `CHART_TYPE_OPTIONS`

**2. Componente `ConfigurableFunnel.tsx`**
- Recebe `data: AggregatedDataPoint[]`, `formatting`, e `appearance`
- Renderiza barras horizontais centralizadas com largura proporcional ao valor
- A primeira barra (maior valor) ocupa 100% da largura
- Cada barra mostra: nome da etapa, contagem, e percentual de conversao em relacao a etapa anterior
- Usa cores do `appearance.colorPalette` ou cores individuais de cada data point (como as cores das etapas do funil)
- Layout visual identico ao `SalesFunnelChart` existente (barras centralizadas, badges de percentual)

**3. Fluxo no AddVisualModal**
- O funil segue o fluxo padrao de 3 passos: Tipo -> Metrica -> Agrupamento
- Funciona com qualquer metrica (deals_count, revenue, leads_count, etc.)
- Funciona com qualquer agrupamento (por etapa, por vendedor, por mes, etc.)
- Quando agrupado por etapa do funil, os dados sao automaticamente ordenados pelo `display_order`

**4. Ordenacao especial para etapas (useVisualData.ts)**
- Quando o `chartType` for `'funnel'` e a dimensao for `stage_name`, buscar `display_order` das `deal_stages` e ordenar o resultado pela ordem do pipeline em vez de ordenar por valor
- Para outras dimensoes, manter a ordenacao padrao por valor decrescente (que ja faz sentido para funil)

**5. Logica de renderizacao do funil**
```text
+------------------------------------------+
| Etapa 1 (maior)              811         |
+------------------------------------------+
   +-----------------------------------+
   | Etapa 2                749  92%   |
   +-----------------------------------+
      +----------------------------+
      | Etapa 3           445  59% |
      +----------------------------+
         +---------------------+
         | Etapa 4    350  79% |
         +---------------------+
            +----------------+
            | Etapa 5   66   |
            +----------------+
```

- Cada barra tem largura proporcional: `max(valor / maxValor * 100, 15)%`
- Conversao calculada: `(valorAtual / valorAnterior) * 100`
- Cores: usa a cor da etapa se disponivel, senao usa a paleta de cores selecionada
