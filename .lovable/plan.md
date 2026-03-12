

## Correção: Scrollbar no seletor de colunas do Explorar Dados

### Problema
O `PopoverContent` do Radix UI aplica **collision avoidance** por padrão, limitando a altura do popover para caber na viewport. Quando isso acontece, o conteúdo interno é cortado sem gerar scrollbar, pois o `overflow-y-auto` está no div interno mas o container externo (o próprio popover) é quem está sendo reduzido.

Existem 19 campos personalizados com `show_in_deals=true`, mas o popover mostra apenas 1 porque o restante fica invisível abaixo do corte.

### Solução
No arquivo `src/components/insights/visuals/DrilldownDialog.tsx`:

1. Substituir o `div` com `overflow-y-auto` por um `ScrollArea` (componente já importado no arquivo, linha 11)
2. Adicionar `style={{ maxHeight: 'var(--radix-popover-content-available-height, 400px)' }}` ao ScrollArea — isso usa a variável CSS que o Radix expõe com a altura real disponível após collision detection
3. Remover o `max-h-[400px]` fixo do div wrapper

Isso garante que, independente de onde o popover é posicionado, o conteúdo sempre terá scrollbar funcional dentro do espaço disponível.

### Arquivo editado
- `src/components/insights/visuals/DrilldownDialog.tsx` (linhas 200-232)

