

## Corrigir visual de Barras Empilhadas (Leads por Canal)

### Problemas identificados

1. **Eixo Y cortado**: A largura do eixo Y esta definida como `width={30}` (linha 124), insuficiente para textos como "Trafego Pago" ou "Nao Informado". O componente `HorizontalBarChartView` (barras simples) usa `width={120}`.

2. **Legenda desnecessaria**: O componente sempre renderiza `<Legend>` (linhas 128-132), mesmo quando so existe uma serie (ex: todos os leads tem status "Nao informado"), poluindo o visual.

3. **Rotulos de dados redundantes**: A funcao `renderInsideLabel` exibe o valor formatado dentro das barras, mas o tooltip mostra "Trafego Pago > Nao Informado: 69" -- a redundancia vem do fato de que a serie (stackBy) so tem um valor ("Nao informado"), tornando a legenda e os rotulos por serie desnecessarios.

### Alteracoes

#### `src/components/insights/visuals/StackedHorizontalBarChart.tsx`

1. **Aumentar largura do eixo Y (linha 124):** Alterar `width={30}` para `width={120}` para acomodar textos longos sem corte.

2. **Condicionar a legenda:** Renderizar o `<Legend>` apenas quando houver mais de 1 serie (`seriesKeys.length > 1`). Quando so existe uma serie, a legenda e redundante.

3. **Melhorar tooltip:** Quando o nome da serie for igual a "Nao informado" e for a unica serie, exibir apenas o valor total sem listar a serie individualmente. Isso evita "Nao informado, Nao informado".

### Resultado

- O texto do eixo Y ("Trafego Pago", "Nao Informado") sera exibido completo
- A legenda no topo so aparecera quando houver multiplas series relevantes
- O tooltip mostrara informacoes uteis sem redundancia
