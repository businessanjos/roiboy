# Redesign do módulo Processos Eternum (piloto 1.1 e 1.3)

Conteúdo, cores (dourado/bege) e permissões ficam iguais. Muda só a organização e a apresentação.

## O que muda
1. **Visão geral no topo**: fases como cartões lado a lado ligados por setas (nome, nº de etapas, progresso). Clicar leva à primeira etapa pendente da fase.
2. **Tela em 2 colunas**
   - Esquerda (~280px, fixa): barra "Onboarding — 4 de 12 etapas", fases e etapas numeradas (1.1, 1.2…) com ✓ feito / ● atual / ○ pendente.
   - Direita: **uma etapa por vez**, rodapé fixo "← Etapa anterior" e "Concluir e ir para a próxima →" (usa o progresso que já existe).
   - Celular: a navegação vira um seletor no topo.
3. **Cabeçalho da etapa**: selo colorido "FASE 1 · BOAS-VINDAS", título grande "1.3 Grupos de WhatsApp", linha com quem faz, quando e nº de ações.
4. **Linha do tempo de passos numerados**, cada tipo com ícone próprio:
   - Mensagem: cartão branco com borda dourada, canal, botão "Copiar" grande; longas recolhidas em 3 linhas com "Ver mensagem completa"; toast "Mensagem copiada ✓".
   - Tarefa: linha com checkbox.
   - Aguardar cliente: faixa tracejada com ampulheta, texto em itálico.
   - Alerta: caixa amarela/vermelha com triângulo.
   - Link: botão com nome claro ("Abrir arte no Canva (EM)").
   - Some o rótulo "Mensagem pronta" e o relógio genérico.
5. **Variáveis** `{Nome}`, `{login}`, `{senha}`, `{cliente}` viram etiquetas; com cliente selecionada, são preenchidas antes de copiar (sem dado, a etiqueta permanece).
6. **Markdown cru** (`*(ESPERA)*`, `*texto*`, `**texto**`) passa a virar itálico/negrito de verdade.
7. **Tipografia**: etapa 22–24px, passos 16px, 24px entre passos, texto até ~760px, fundo bege e cartões brancos.
8. **Tour**: recorte iluminado no elemento real, balão grudado nele com setinha e sem cobri-lo, progresso em bolinhas. Os passos apontam para: navegação, selo de status, mensagem com Copiar, tarefa, alerta e botão "Concluir e ir para a próxima".

## Piloto
O novo visual de etapa fica pronto e revisado em **1.1 Mensagem de boas-vindas** e **1.3 Grupos de WhatsApp**. Antes de seguir para as outras etapas, eu mando prints para você aprovar. A estrutura nova vale para todas, mas as demais só recebem ajustes finos de classificação depois do seu OK.

## Detalhes técnicos
- `src/lib/csProcesses.ts`: classificar cada linha do parser em `message | task | wait | alert | link` (ESPERA/aguardar → wait; ⚠️ → alert; `- [ ]` → task; `>` → message; URL → link com rótulo vindo do texto) e extrair quem/quando. O texto editável pelos gestores continua no mesmo formato.
- Novos componentes em `src/components/csProcesses/`: `ProcessOverview`, `StepNavigator`, `StepDetail`, `StepActionItem`, `InlineMarkdown`, `VariableChip`.
- `GuidedTour.tsx`: posicionar o balão com o retângulo do alvo (acima/abaixo/lado conforme o espaço) e uma seta; bolinhas de progresso.
- `CSProcesses.tsx`: a aba Lista passa a ser o novo layout; o Fluxograma continua como está.
- Nenhuma mudança no banco ou nas permissões.
