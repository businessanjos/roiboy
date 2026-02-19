
## Corrigir visibilidade dos elementos no modal de Compartilhamento

### Problema
O `overflow-x-hidden` no `DialogContent` esta cortando o botao de copiar, o botao "Desativar" e o texto "Nenhuma solicitacao". O problema anterior era que a URL longa empurrava esses elementos para fora do modal.

### Causa raiz
O problema real e que a div da URL (`flex-1`) nao esta limitando sua largura. O `truncate` so funciona se o elemento tiver uma largura maxima definida. Usar `overflow-x-hidden` no container pai apenas esconde o problema em vez de resolve-lo.

### Solucao definitiva

**Arquivo**: `src/components/insights/ShareDashboardModal.tsx`

1. **Remover `overflow-x-hidden` do `DialogContent`** (linha 157) - isso esta cortando conteudo legitimo.

2. **Usar `overflow-hidden` apenas no container flex da URL** (linha 182) - isso limita o overflow apenas naquela linha especifica, sem afetar o resto do modal.

3. **Adicionar `w-full` ao container flex da URL** para garantir que ele respeite a largura do pai.

Alteracoes:
- Linha 157: `sm:max-w-lg overflow-x-hidden` -> `sm:max-w-lg`
- Linha 182: `flex items-center gap-2 min-w-0` -> `flex items-center gap-2 min-w-0 w-full overflow-hidden`

A diferenca chave: `overflow-hidden` no container da URL (que contem apenas a URL e o botao copiar) nao corta nada pois o botao copiar tem `shrink-0` e a URL tem `truncate`. Ja no `DialogContent` inteiro, cortava o status toggle e as solicitacoes de acesso.
