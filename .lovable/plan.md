
## Correcao definitiva do overflow no modal de Compartilhamento

### Problema recorrente

Cada tentativa anterior falhou por causa de uma regra CSS: quando voce define `overflow-x: hidden` em um elemento, o CSS automaticamente muda `overflow-y` de `visible` para `auto`. Isso explica porque:

- `overflow-hidden` no DialogContent: cortava conteudo vertical (botao copiar, "Nenhuma solicitacao")
- `overflow-x-hidden` no DialogContent: mesmo efeito, pois o DialogContent tem altura restrita pelo posicionamento fixo
- Sem overflow: a URL vaza para fora do modal

### Solucao

Aplicar `overflow-x-hidden` no div `space-y-4` **interno** (nao no DialogContent). Esse div nao tem altura fixa, entao o `overflow-y: auto` implicito nao corta nada -- ele simplesmente cresce com o conteudo.

### Alteracoes

**Arquivo**: `src/components/insights/ShareDashboardModal.tsx`

1. **Linha 165**: Adicionar `overflow-x-hidden` ao wrapper `space-y-4`:
   - `<div className="space-y-4">` para `<div className="space-y-4 overflow-x-hidden">`

2. **Linha 182**: Remover `w-full overflow-hidden` do container da URL (o pai ja cuida do overflow):
   - `flex items-center gap-2 min-w-0 w-full overflow-hidden` para `flex items-center gap-2 min-w-0`

Resultado: a URL sera truncada corretamente, e o botao copiar, badge "Ativo", botao "Desativar" e texto "Nenhuma solicitacao de acesso ainda" ficarao todos visiveis dentro do modal.
