
## Corrigir layout achatado no painel compartilhado

### Problema

O grid do painel compartilhado esta renderizando os visuais em uma coluna estreita e achatada por dois motivos:

1. **Falta o `compactor`**: O `InsightsGrid` original usa `getCompactor(null, true, false)` para permitir posicionamento livre sem compactacao. O `SharedInsightsDashboard` nao tem essa configuracao, entao o `react-grid-layout` compacta todos os itens verticalmente, achatando o layout.

2. **Faltam estilos CSS**: O grid original tem estilos customizados para transicoes e handles de redimensionamento. Sem eles, o grid pode se comportar de forma inesperada.

### Alteracoes

**Arquivo: `src/pages/SharedInsightsDashboard.tsx`**

1. Importar `getCompactor` de `react-grid-layout/core`
2. Criar a constante `freePositionCompactor` igual ao `InsightsGrid`
3. Adicionar a prop `compactor={freePositionCompactor}` no `GridLayout`
4. Adicionar estilos CSS inline para o grid (transicoes desabilitadas, placeholder oculto)
5. Adicionar classe `shared-insights-grid` ao container para scoping dos estilos

Essas alteracoes alinham o comportamento do grid compartilhado com o grid original, garantindo que os visuais respeitem suas posicoes salvas e ocupem a tela inteira.
