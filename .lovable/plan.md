# Processos: trocar "Hoje" por "Em andamento"

## O que muda para a equipe
1. **Aba "Hoje" vira "Em andamento"** (continua a primeira). Saem: lista de tarefas, grupos Atrasadas/Hoje/Próximos 7 dias, botões Concluir/Adiar, resumo "Você tem X tarefas" e o contador no menu lateral.
2. **Quadro por fases** com seletor no topo: Onboarding | Encontro Online | Encontro Presencial.
   - Colunas = fases do processo, na ordem e na cor dele. Cabeçalho mostra só "Fase · N".
   - Cartões = cada cliente (onboarding) ou evento (encontros) na fase em que está: foto e nome (ou nome e data do evento), etapa atual por extenso ("1.3 Grupos de WhatsApp"), mini trilha de bolinhas da fase, avatar da consultora, "há 3 dias" na etapa, selo "⏳ Aguardando cliente".
   - Vazio por coluna: "Ninguém nesta fase agora".
   - Desktop: colunas com rolagem horizontal. Celular: uma coluna por vez, com abas das fases.
3. **Trilha individual** (abre ao clicar no cartão): linha horizontal estilo metrô com todas as fases e etapas — feitas preenchidas com data, atual pulsando de leve, próximas em cinza.
   - Onboarding: após a última etapa, círculo do ciclo mensal marcando o momento do mês.
   - Encontros: trilha pelas datas (60 dias antes → no dia → 7 dias depois) com marcação "hoje".
   - Botão **"Ir para a etapa atual"** abre o passo a passo já com a cliente/evento selecionado.
4. **Filtros:** Consultora ("Minhas clientes"; gestores veem "Todas" ou uma consultora), busca por nome, chave "Somente aguardando cliente".
5. **Tour:** o capítulo da tela Hoje passa a apresentar o quadro ("Aqui você vê cada cliente e cada encontro na fase em que está") e a trilha.

Continua igual: conteúdo dos processos, passo a passo, fluxograma, links por cliente, selo de espera e edição pelo lápis.

## Como a etapa atual é decidida
- **Onboarding:** primeira etapa não concluída no progresso da cliente; "há X dias" conta desde a última etapa concluída (ou início do onboarding). Clientes que terminaram todas as etapas ficam em "Acompanhamento mensal".
- **Encontros:** a etapa vem da data do evento, usando as mesmas réguas de datas dos lembretes (online −15/−10/−3/−1/0/+1; presencial −60/+1/+7). Eventos encerrados há mais de 7 dias saem do quadro.

## Detalhes técnicos
- Novo `src/lib/csInProgress.ts` (puro): monta cartões por processo/fase a partir de progresso, esperas e eventos; reaproveita `spDate`, `isEncontroOnline/Presencial` e offsets de `csToday.ts` (lógica de datas mantida). Testes em `csInProgress.test.ts`.
- Novo hook `useCsInProgress` (reaproveita `useOnboardingClientsData`, `cs_process_progress`, `cs_process_waits`, eventos), sem consultas de contato quinzenal, metas ou estados de tarefa.
- Novos componentes `InProgressBoard.tsx` e `ProcessTrack.tsx`; `TodayView.tsx` e `useCsTodayTasks.ts` deixam de ser usados (removidos); contador removido do `Sidebar.tsx`.
- `CSProcesses.tsx`: aba renomeada, URL `?client=/event=&proc=&step=` reaproveitada pelo "Ir para a etapa atual"; tour atualizado.
- Sem mudanças no banco nem em permissões; tabela `cs_today_task_states` fica sem uso (não será apagada).
