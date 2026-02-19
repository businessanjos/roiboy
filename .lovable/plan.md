

## Corrigir overflow no modal de Compartilhamento

### Problema

O link de compartilhamento (URL longa) e o botao "Desativar" estao vazando para fora dos limites do modal, como visivel na imagem.

### Causa

1. A `div` que exibe a URL usa `truncate` mas o container pai (`flex items-center gap-2`) nao tem `min-w-0`, impedindo o truncamento correto em flex containers.
2. O container principal do conteudo nao tem `overflow-hidden`.

### Correcao

**Arquivo**: `src/components/insights/ShareDashboardModal.tsx`

1. Adicionar `overflow-hidden` ao `DialogContent` para garantir que nada vaze:
   - Linha 157: `sm:max-w-lg` -> `sm:max-w-lg overflow-hidden`

2. Adicionar `min-w-0` no container flex da URL (linha 182) para permitir que o `truncate` funcione corretamente dentro do flexbox:
   - `flex items-center gap-2` -> `flex items-center gap-2 min-w-0`

3. Garantir que a div do link tambem tenha `overflow-hidden` alem de `truncate` (linha 183):
   - Adicionar `overflow-hidden` a div que mostra a URL

4. Adicionar `shrink-0` no botao de copiar (linha 186) para que ele nao seja comprimido pelo flex.

Essas alteracoes sao puramente de CSS e nao afetam a logica do componente.
