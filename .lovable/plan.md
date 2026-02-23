
## Adicionar tipo de visual "Indicador" ao Insights

### O que sera feito

Adicionar um novo tipo de visualizacao chamado **"Indicador"** na aba Insights. Este visual exibe um valor numerico dentro de um arco semicircular simples (monocromático), com valores minimo e maximo configuráveis pelo usuario no momento da criacao. Diferente do "Conta-Giro" existente (que tem faixas coloridas e subtipo fixo), o Indicador e generico e trabalha com qualquer metrica.

### Diferenca entre Indicador e Conta-Giro

| Caracteristica | Conta-Giro (existente) | Indicador (novo) |
|---|---|---|
| Arco | Faixas coloridas (verde/amarelo/laranja/vermelho) | Arco unico monocromatico (cinza) |
| Subtipos | Dias Corridos / Faturamento x Meta | Nenhum - generico |
| Min/Max | Fixos (calculados automaticamente) | Configuráveis pelo usuario |
| Fonte de dados | Fixa (deals) | Qualquer fonte (deals, leads, etc.) |

### Alteracoes tecnicas

#### 1. `src/components/insights/visual-builder/types.ts`
- Adicionar `'indicator'` ao tipo `ChartType`
- Adicionar opcao `{ value: 'indicator', label: 'Indicador' }` em `CHART_TYPE_OPTIONS`
- Adicionar campo `indicatorConfig` opcional ao `VisualConfig`:
  ```
  indicatorConfig?: {
    minValue: number;
    maxValue: number;
    minLabel?: string;
    maxLabel?: string;
  }
  ```

#### 2. `src/components/insights/visual-builder/ChartTypeSelector.tsx`
- Importar icone `Activity` do lucide-react
- Adicionar mapeamento `indicator: Activity` no `ICON_MAP`

#### 3. `src/components/insights/visual-builder/VisualBuilderSheet.tsx`
- Adicionar estados `indicatorMin` e `indicatorMax` (strings para input)
- Adicionar estados `indicatorMinLabel` e `indicatorMaxLabel` (strings opcionais)
- No bloco condicional onde `isGauge` e tratado, adicionar um novo bloco `isIndicator` que mostra:
  - Selecao de fonte de dados, medida, dimensao e formatacao (reutilizando componentes existentes)
  - Inputs para "Valor Minimo" e "Valor Maximo"
  - Inputs opcionais para labels do min/max
- Atualizar `canCreate` para validar o tipo indicator
- No `handleCreate`, montar o config com `indicatorConfig`

#### 4. `src/components/insights/visuals/ConfigurableIndicator.tsx` (novo arquivo)
- Componente SVG com arco semicircular unico em cinza
- Ponteiro (needle) indicando a posicao do valor
- Valor numerico centralizado abaixo do arco
- Labels de min e max nas extremidades
- Props: `value`, `min`, `max`, `label`, `minLabel`, `maxLabel`, `formatValue`, `fontScale`

#### 5. `src/components/insights/visuals/ConfigurableChart.tsx`
- Importar `IndicatorFromConfig` do novo componente
- Adicionar case `'indicator'` no switch que renderiza o componente correto

#### 6. `src/components/insights/visuals/index.ts`
- Exportar o novo componente `ConfigurableIndicator`

### Fluxo do usuario

1. O usuario clica em "Adicionar Visual"
2. Seleciona o tipo "Indicador" no grid de tipos
3. Configura fonte de dados, medida e dimensao (como qualquer outro grafico)
4. Preenche o valor minimo e maximo desejados
5. Opcionalmente define labels para min/max (ex: "0 Mil", "1 Milhao")
6. Define o titulo e cria o visual
7. O indicador exibe o valor agregado dos dados dentro do arco semicircular
