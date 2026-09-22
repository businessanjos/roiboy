# Transferência de pendências por módulo, com destinatário diferente em cada linha

Hoje a janela de inativação lista 6 tipos de pendência e manda tudo para uma única pessoa. Passa a listar todas as pendências do membro, organizadas por área, e cada linha pode ir para uma pessoa diferente.

## Como fica a janela

**1. Revise os itens pertencentes ao usuário** — as pendências aparecem agrupadas por área, com a contagem de cada uma:

- **Vendas**: negócios em aberto, leads em aberto, atividades agendadas não concluídas, reuniões de vendas agendadas, clientes onde ele é o vendedor
- **Atendimento / CS**: clientes da carteira (responsável), conversas do RoyZapp em aberto, régua de relacionamento, chamados de suporte
- **Marketing**: projetos que ele lidera, peças de conteúdo atribuídas, aprovações de conteúdo sob responsabilidade dele
- **Eventos**: itens de checklist, entregáveis de conteúdo e briefings sob responsabilidade dele
- **Financeiro**: cobranças/inadimplência em aberto atribuídas a ele
- **RH**: admissões e desligamentos que ele conduz
- **Geral**: tarefas pendentes, ações da reunião de líderes com dono definido

Cada área pode ser recolhida/expandida e tem um atalho "marcar tudo desta área". Linhas com zero ficam desabilitadas.

**2. Para quem vai cada coisa**

- Um seletor de **destinatário padrão** no topo (com "Para mim mesmo" destacado e busca), que preenche todas as linhas marcadas.
- Em cada linha, um seletor próprio que sobrepõe o padrão — assim o gestor comercial manda negócios e leads para o novo vendedor, e as peças de marketing vão para o novo social media, na mesma operação.
- Linha marcada sem destinatário fica em aviso e não é transferida: continua contando como pendência do membro (marca laranja na lista de Equipe).

O resumo no rodapé mostra quantos itens vão para cada pessoa antes de confirmar.

## O que nunca muda

Histórico permanece no nome dele: atividades concluídas, mensagens, negócios ganhos/perdidos, comissões, tarefas concluídas, check-ins, logs. Só muda quem é o responsável **atual** de itens ainda abertos.

## Auditoria

Cada transferência grava quem executou, data/hora, de quem para quem e quantos itens de cada tipo — agora com um registro por destinatário, já que podem ser vários. Aparece nos logs do sistema e no histórico dentro da própria janela.

## Detalhes técnicos

- `supabase/functions/deactivate-team-user/index.ts`: catálogo de itens passa de 6 para o conjunto completo, cada um com `{ key, group, label, table, column, openFilter }`:
  - Vendas: `deals.responsible_user_id` + `deals.sdr_user_id` (status open), `leads.responsible_user_id` (new/contacted/qualified), `deal_activities.user_id` (agendadas sem `completed_at`), `sales_meetings.responsible_user_id` (status em aberto), `clients.sales_user_id` (status active/paused/churn_risk)
  - CS: `clients.responsible_user_id`, `zapp_conversation_assignments.agent_id` via `zapp_agents` (pending/active/waiting/triage), `zapp_ruler_enrollments.assigned_to`, `support_tickets.assigned_to`
  - Marketing: `marketing_projects.owner_user_id`, `content_pieces.assigned_user_id`, `content_approval_checklists.responsible_user_id`
  - Eventos: `event_checklist.assigned_to` (sem `completed_at`), `event_content_deliverables.assigned_to`, `event_briefings.responsible_user_id`
  - Financeiro: `dunning_cases.assigned_to` (stage não encerrado)
  - RH: `hr_admissions.responsible_user_id` (stage não concluído), `hr_offboardings.responsible_user_id` (sem `completed_at`)
  - Geral: `internal_tasks.assigned_to` (pending/in_progress/overdue), `leader_meeting_actions.owner_user_id` (sem `completed_at`)
  - Os filtros de "aberto" por status serão confirmados por consulta aos valores reais de cada tabela antes de fixar a regra; onde não houver status confiável, o filtro usa ausência de conclusão.
- `count_open_items` retorna `{ key: count }` com todas as chaves e `transfer_open_items` passa a aceitar `assignments: [{ key, to_user_id }]` em vez de um único destinatário (o formato antigo continua aceito). Conversas continuam exigindo que o destinatário tenha agente no RoyZapp; sem agente, a linha é reportada como não transferida.
- Cada `to_user_id` gera um registro em `audit_logs` com `action='user.open_items_transferred'` e `details` contendo origem, destino e contagem por tipo.
- `src/components/settings/DeactivateUserDialog.tsx`: catálogo com grupo/ícone por item, seções recolhíveis, seletor padrão + seletor por linha (ambos com busca e "Para mim mesmo" destacado), resumo por destinatário, e montagem do payload `assignments`.
- `src/components/settings/TeamManager.tsx`: sem mudança estrutural — o total de pendências e a marca laranja passam a considerar o conjunto ampliado automaticamente.
- Sem migração de banco e sem alteração de RLS: a função roda com service role e continua restrita a administradores da conta.
