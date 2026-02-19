

## Corrigir conteudo oculto no modal de Compartilhamento

### Problema

O `overflow-hidden` adicionado ao `DialogContent` esta cortando o botao de copiar e o texto "Nenhuma solicitacao de acesso ainda." na parte inferior do modal.

### Causa

O `overflow-hidden` no `DialogContent` resolve o vazamento lateral mas tambem corta o conteudo que precisa de espaco vertical. O modal nao esta expandindo o suficiente para acomodar todo o conteudo.

### Correcao

**Arquivo**: `src/components/insights/ShareDashboardModal.tsx`

1. **Remover `overflow-hidden` do `DialogContent`** - essa abordagem e muito agressiva e corta conteudo legitimo.

2. **Adicionar `overflow-hidden` apenas no container do link** (a div flex que contem a URL e o botao copiar) em vez do DialogContent inteiro. O container flex da URL ja tem `min-w-0` e `truncate`, entao basta garantir que o wrapper nao ultrapasse o limite.

3. **Usar `max-w-full` no container flex da URL** para garantir que ele respeite o limite do pai sem afetar o resto do modal.

Alteracoes especificas:
- Linha 157: `sm:max-w-lg overflow-hidden` -> `sm:max-w-lg`
- Linha 182: `flex items-center gap-2 min-w-0` -> `flex items-center gap-2 min-w-0 overflow-hidden`

Isso mantem o truncamento da URL sem cortar o botao de copiar nem o conteudo abaixo.

