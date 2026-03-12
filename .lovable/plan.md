
Objetivo: corrigir a rolagem do popover “Colunas” para funcionar com a roda do mouse (sem depender de arrastar a barra).

Diagnóstico
- O container já tem `overflow-y-scroll`, mas por estar dentro de `Popover` em um `Dialog`, o evento de wheel está sendo capturado/interferido no nível superior.
- Resultado: a rolagem por roda do mouse não aplica no conteúdo do seletor, embora arrastar a barra funcione.

Plano de implementação
1. Em `src/components/insights/visuals/DrilldownDialog.tsx`, tornar o popover modal (`<Popover modal={true}>`) para isolar melhor interação/scroll no contexto do dialog.
2. No container scrollável da lista de colunas, adicionar handler de wheel robusto:
   - `onWheel={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.scrollTop += e.deltaY; }}`
   - Isso garante rolagem por mouse wheel mesmo quando o scroll padrão é bloqueado por camadas externas.
3. Manter as classes atuais de UX (`overflow-y-scroll`, `overscroll-contain`, `max-h-[min(350px,calc(100vh-12rem))]`, `playbook-scroll-native`) para preservar barra visível e limite em telas menores.
4. Validar comportamento:
   - Roda do mouse para cima/baixo dentro do popover.
   - Acesso até o último campo personalizado.
   - Sem “scroll bleed” no modal pai.

Resultado esperado
- O usuário conseguirá navegar toda a lista apenas com o scroll do mouse, de forma consistente em telas grandes e pequenas.
