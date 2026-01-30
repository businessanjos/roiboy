
# Plano: Adicionar Barra de Rolagem ao Dialog de Momentos CX

## Problema
O dialog "Novo Momento CX" cresceu muito com os novos campos (toggle de envio automático, horário, etc.) e não cabe mais na tela, impedindo o usuário de navegar entre as opções e acessar os botões de ação.

## Solução
Adicionar um `ScrollArea` ao conteúdo do dialog para permitir rolagem quando o conteúdo exceder a altura máxima disponível.

## Alterações Técnicas

### Arquivo: `src/components/client/ClientLifeEvents.tsx`

1. **Importar ScrollArea**
   - Adicionar import do componente `ScrollArea` de `@/components/ui/scroll-area`

2. **Reestruturar DialogContent**
   - Aplicar `max-h-[90vh]` e `p-0` ao `DialogContent` para controlar altura máxima
   - Mover o `DialogHeader` para fora do scroll (fixo no topo)
   - Envolver o conteúdo do formulário (`<div className="space-y-4 py-4">`) em um `ScrollArea`
   - Aplicar `className="max-h-[calc(90vh-180px)]"` ao ScrollArea para deixar espaço para header e footer
   - Adicionar padding interno ao conteúdo scrollável (`px-6 pb-4`)
   - Mover `DialogFooter` para fora do scroll (fixo no rodapé) com `px-6 pb-6`

### Estrutura Final

```text
DialogContent (max-h-[90vh], p-0)
├── DialogHeader (px-6 pt-6 - fixo no topo)
├── ScrollArea (flex-1, overflow)
│   └── Conteúdo do formulário (px-6 pb-4)
└── DialogFooter (px-6 pb-6 - fixo no rodapé)
```

Este padrão já é utilizado no `MarketingTaskDialog.tsx` e garante que:
- O cabeçalho e rodapé ficam sempre visíveis
- O conteúdo central é scrollável
- O dialog nunca ultrapassa 90% da altura da viewport
