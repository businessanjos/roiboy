
# Plano: Corrigir Barra de Rolagem do Dialog de Momentos CX

## Problema
O dialog "Novo Momento CX" não está exibindo barra de rolagem, fazendo com que campos como "Evento Recorrente" e "Enviar automaticamente" fiquem escondidos e inacessíveis.

## Causa
A implementação atual usa `ScrollArea` do Radix UI, que requer configuração específica de altura fixa. A estrutura com `flex flex-col` e `p-0` criou conflitos que impedem o scroll de funcionar corretamente.

## Solução
Simplificar a abordagem usando o padrão já estabelecido em outros dialogs do projeto: aplicar `overflow-y-auto` diretamente no `DialogContent`, sem usar `ScrollArea`.

## Alterações Técnicas

### Arquivo: `src/components/client/ClientLifeEvents.tsx`

1. **Remover import do ScrollArea** (linha 10)
   - Não será mais necessário

2. **Simplificar DialogContent**
   - Remover: `p-0 flex flex-col`
   - Manter: `max-h-[90vh] overflow-y-auto`

3. **Remover estrutura ScrollArea**
   - Remover o wrapper `<ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">`
   - Manter apenas o conteúdo interno

4. **Ajustar paddings**
   - Remover `px-6 pt-6` do DialogHeader (volta ao padrão)
   - Remover `px-6` do conteúdo interno
   - Remover `px-6 pb-6 pt-4 border-t` do DialogFooter

### Estrutura Final (simplificada)

```text
DialogContent (max-h-[90vh] overflow-y-auto)
├── DialogHeader (padrão)
├── Conteúdo do formulário (space-y-4 py-4)
└── DialogFooter (padrão)
```

Este é o padrão usado em 50+ outros dialogs do projeto e funciona consistentemente.
