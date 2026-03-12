
Objetivo: corrigir o seletor “Colunas” do Explorar Dados para que a rolagem funcione sempre e nenhuma opção fique inacessível.

Diagnóstico atual
- O popover de colunas está em `src/components/insights/visuals/DrilldownDialog.tsx`.
- Hoje ele usa `ScrollArea` customizada com `max-h-[350px]`, mas para este caso a barra não está aparecendo/funcionando de forma confiável dentro do popover.
- Resultado: quando há muitos campos personalizados, itens no fim da lista ficam inacessíveis.

Plano de implementação
1. Trocar a área de rolagem da lista de colunas para rolagem nativa do navegador (mais confiável neste contexto de popover):
   - Substituir o `<ScrollArea ...>` por um `<div ...>` scrollável.
2. Forçar scroll vertical sempre disponível:
   - Usar classe com altura limitada + `overflow-y-scroll` (não `auto`) para manter a barra presente.
3. Garantir comportamento em telas menores:
   - Aplicar limite de altura com viewport-safe (ex.: `max-h-[min(350px,calc(100vh-12rem))]`) para nunca ultrapassar a janela.
4. Melhorar usabilidade do scroll:
   - Adicionar `overscroll-contain` para evitar “scroll bleed” no modal pai.
   - Aplicar classe de scrollbar nativa já existente (`playbook-scroll-native`) para pista visual da barra.
5. Limpeza:
   - Remover import não usado de `ScrollArea` em `DrilldownDialog.tsx`.

Arquivo afetado
- `src/components/insights/visuals/DrilldownDialog.tsx`

Validação após implementação
- Abrir “Colunas” com muitos campos personalizados e confirmar acesso até o último item.
- Testar em altura menor de viewport para confirmar que o popover não estoura a tela e continua rolável.
- Confirmar que seleção/desseleção de campos continua funcionando normalmente.
