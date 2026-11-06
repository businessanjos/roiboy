# Processos Eternum: fluxograma e tour guiado

O texto dos processos continua exatamente igual. Só muda a forma de ver e entra o tour.

## 1. Lista ou Fluxograma
- No topo de cada processo entra o botão **Lista | Fluxograma**. A tela lembra a última escolha.
- **Fluxograma:**
  - cada fase vira um bloco grande, com as etapas dentro em cartões menores ligados por setas;
  - as cores de cada processo continuam: Onboarding roxo, Encontro Online verde-água e Encontro Presencial azul.
- **Cartão de etapa:** mostra o título, um ícone (mensagem, tarefa, link ou alerta) e o número de tarefas. Ao clicar, abre um painel lateral com o conteúdo completo: mensagens com Copiar, checklist e links.
- **Ciclo mensal do Onboarding:** aparece em círculo (durante o mês → última semana → primeiro dia → primeiros dias), com seta voltando ao início.
- **Encontros:** uma régua de tempo com os marcos 60 dias antes, 15, 10, 3, 1 dia antes, no dia, dia seguinte e até 7 dias depois.
- **Zoom e arrastar:** pela roda do mouse, pelos botões + / − / centralizar e com o movimento de pinça.
- **Celular:** vira uma lista vertical com setas para baixo, sem zoom.
- **Visual:** cantos arredondados, sombras suaves, bastante espaço e uma animação leve ao abrir.

## 2. Status nos cartões
- **Concluído:** verde com ✓. **Atual:** destacado, pulsando de leve. **Pendente:** cinza.
- O status só aparece quando o processo é aberto dentro de uma cliente ou de um evento. Para isso entra junto o acompanhamento por cliente e por evento, que já estava previsto no plano anterior.
  - O progresso fica salvo por cliente e por evento.
  - A etapa atual é a primeira que ainda não foi concluída.

## 3. Tour guiado
- **Primeiro acesso:** um tour de 8 passos com os textos que você enviou.
  - A tela escurece e um balão aponta cada parte.
  - Os botões são Próximo, Voltar e Pular tour, com a contagem "3 de 8".
  - O primeiro e o último passo aparecem no centro da tela, com "Bora!" / "Agora não" e "Começar".
- **Rever o tour:** um botão **?** fixo no canto inicia o tour de novo.
- **Mini tour da cliente:** na primeira vez que a consultora abre o onboarding de uma cliente, aparecem 3 passos, já com o nome da cliente.
- **Não repetir:** o sistema guarda no perfil de cada pessoa que ela já viu cada tour, então o tour não volta em outro computador.

## Detalhes técnicos
- Fluxograma com `@xyflow/react` (zoom, arrastar e pinça nativos). As posições são calculadas a partir do mesmo `csProcesses` já existente, sem duplicar conteúdo.
- O tour é um componente próprio com destaque por `data-tour` e foco preso no balão. O botão Pular e a tecla Esc fecham o tour.
- Novas tabelas:
  - `user_tour_views` (user_id, tour_key, seen_at), RLS somente o próprio usuário;
  - `cs_process_progress` (account_id, process_id, target_type cliente/evento, target_id, step_key, done_by, done_at), RLS pela conta.
- Abertura dentro de uma cliente: link "Processo" no painel do Onboarding Hub (`/operations/processos?client=...`). Abertura dentro de um evento: `?event=...`.
- Respeita o modo escuro, com as cores dos processos como tokens. Nenhuma permissão, contrato ou integração muda.
