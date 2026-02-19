

## Corrigir overflow no modal de Compartilhamento (solucao definitiva)

### Problema

A URL longa do link de compartilhamento continua vazando para fora do modal. O botao "Copiar" e o botao "Desativar" aparecem fora dos limites do modal. Tentativas anteriores de usar `overflow-hidden` no `DialogContent` cortaram conteudo vertical.

### Causa raiz

O `DialogContent` usa `max-w-lg` mas os filhos flex nao estao respeitando esse limite. O `truncate` no texto da URL nao funciona porque o container flex pai nao tem uma largura explicita limitada. Precisamos restringir o overflow apenas no eixo horizontal, sem afetar o eixo vertical.

### Correcao

**Arquivo**: `src/components/insights/ShareDashboardModal.tsx`

1. **Adicionar `overflow-x-hidden` ao `DialogContent`** (em vez de `overflow-hidden` que corta verticalmente tambem):
   - Linha 157: `sm:max-w-lg` -> `sm:max-w-lg overflow-x-hidden`

Isso resolve o vazamento horizontal da URL e dos botoes sem cortar conteudo que precisa de espaco vertical (como "Nenhuma solicitacao de acesso ainda" e o botao de copiar).

Essa e uma unica alteracao CSS que corrige ambos os problemas simultaneamente.

