

## Correção: Altura fixa com scroll no seletor de colunas

### Problema
A variável CSS `--radix-popover-content-available-height` depende do collision avoidance do Radix, que nem sempre é confiável em telas menores — o popover pode ultrapassar a viewport ou cortar conteúdo.

### Solução
Trocar a abordagem dinâmica por uma **altura máxima fixa de 350px** no `ScrollArea`. Isso garante que a lista sempre terá scrollbar visível independente do tamanho da tela, sem risco de overflow.

### Arquivo editado
- `src/components/insights/visuals/DrilldownDialog.tsx` — linha 201: trocar `style={{ maxHeight: 'var(--radix-popover-content-available-height, 400px)' }}` por `className="max-h-[350px]"`

