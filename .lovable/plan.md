

## Adicionar controle de tamanho de fonte nos visuais do Insights

### Problema

Ao transmitir o painel em uma TV via Chromecast (Modo Foco), os textos dentro dos visuais -- valores de scorecards, rotulos de eixos, labels de dados, textos de gauges e rankings -- ficam muito pequenos e dificeis de ler. Atualmente nao existe nenhuma opcao para ajustar o tamanho da fonte dos elementos internos dos visuais.

### Solucao

Adicionar uma configuracao de **Escala de Fonte** por visual, com opcoes predefinidas (Pequena, Normal, Grande, Extra Grande). Essa escala sera aplicada como um multiplicador nos tamanhos de fonte de todos os elementos internos do visual (eixos, labels, valores, legendas), garantindo que o conteudo se ajuste sem "vazar" para fora do card.

### Como funciona

O usuario acessa as configuracoes do visual (icone de engrenagem) e encontra uma nova opcao "Tamanho da Fonte" na secao de Personalizacao Visual. Ao selecionar um tamanho maior, todos os elementos de texto dentro daquele visual especifico aumentam proporcionalmente.

Opcoes disponiveis:
- **Pequena** (0.8x) -- para visuais com muitos dados compactados
- **Normal** (1x) -- padrao atual
- **Grande** (1.3x) -- para telas maiores / TVs
- **Extra Grande** (1.6x) -- para TVs grandes ou visuais destacados

### Mudancas tecnicas

**1. Arquivo: `src/components/insights/visual-builder/types.ts`**

- Adicionar tipo `FontScale = 'small' | 'normal' | 'large' | 'xlarge'`
- Adicionar constante `FONT_SCALE_OPTIONS` com as 4 opcoes e seus multiplicadores
- Adicionar constante `FONT_SCALE_MULTIPLIERS: Record<FontScale, number>` mapeando cada opcao ao seu fator (0.8, 1.0, 1.3, 1.6)
- Adicionar campo `fontScale?: FontScale` na interface `AppearanceConfig`
- Atualizar `DEFAULT_APPEARANCE` com `fontScale: 'normal'`

**2. Arquivo: `src/components/insights/visual-builder/AppearanceSection.tsx`**

- Adicionar um `Select` para "Tamanho da Fonte" com as 4 opcoes
- Props novas: `fontScale` e `onFontScaleChange`

**3. Arquivo: `src/components/insights/visuals/VisualQuickSettings.tsx`**

- Adicionar estado local `fontScale`
- Passar para `AppearanceSection`
- Incluir no `handleSave` dentro do objeto `appearance`

**4. Arquivo: `src/components/insights/visuals/ConfigurableChart.tsx`**

- Receber `fontScale` da `appearance` config
- Calcular o multiplicador usando `FONT_SCALE_MULTIPLIERS[fontScale]`
- Aplicar nos `fontSize` dos componentes:
  - `XAxis tick.fontSize`: base 10-11 * multiplicador
  - `YAxis tick.fontSize`: base 11 * multiplicador
  - `LabelList style.fontSize`: base 10 * multiplicador
  - Pie label fontSize
- Passar para sub-componentes (BarChartView, LineChartView, PieChartView)

**5. Arquivo: `src/components/insights/visuals/ConfigurableScorecard.tsx`**

- Ler `fontScale` do `config.appearance`
- Aplicar multiplicador nas classes de tamanho de fonte do valor principal (text-2xl, text-3xl, text-4xl tornam-se maiores conforme a escala)
- Usar `style={{ fontSize: baseSize * multiplier }}` em vez de classes Tailwind fixas para controle preciso

**6. Arquivo: `src/components/insights/visuals/ConfigurableGauge.tsx`**

- Receber `fontScale` via `visualConfig.appearance`
- Aplicar multiplicador nos `fontSize` dos elementos SVG `text` (valor e porcentagem)
- Aplicar nos textos de label e sublabel abaixo do gauge

**7. Arquivo: `src/components/insights/visuals/ConfigurableRanking.tsx`**

- Receber `fontScale` via props (adicionado em `ConfigurableChart`)
- Aplicar multiplicador nos tamanhos de fonte da tabela e do podium

**8. Arquivo: `src/components/insights/visuals/StackedHorizontalBarChart.tsx`**

- Receber `fontScale` via `appearance`
- Aplicar multiplicador nos `fontSize` dos eixos, labels internos e legenda

**9. Arquivo: `src/components/insights/visuals/ConfigurableCallCommercial.tsx`**

- Receber `fontScale` via nova prop
- Aplicar multiplicador nos tamanhos de texto dos cards de usuario

### Logica de seguranca contra "vazamento"

Para evitar que textos grandes ultrapassem os limites do visual:
- Scorecards: usar `overflow-hidden` e `text-ellipsis` com `max-width: 100%`
- Charts: os eixos do recharts ja fazem clip automatico; labels de dados que nao cabem serao ocultados via logica condicional existente (ex: `width < 50` no stacked chart)
- Gauges: os textos SVG tem `textAnchor="middle"` e o viewBox controla o limite
- Rankings: ja possuem `truncate` nos nomes

### Resultado esperado

- Cada visual pode ter seu tamanho de fonte ajustado individualmente
- Ao transmitir em TV, o usuario aumenta a fonte dos visuais mais importantes
- Os textos nunca "vazam" para fora dos limites do card
- O padrao ("Normal") mantem o comportamento atual sem nenhuma mudanca visual

