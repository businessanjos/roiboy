# Inativar usuário com transferência de pendências

Na área de gestão (Configurações → Equipe → Membros), além de excluir, passa a existir a opção de **inativar** um membro — mantendo todo o histórico dele intacto e transferindo apenas o que está em aberto.

## Números no topo

Os cartões passam a mostrar **Total de membros**, **Ativos** e **Inativos**, além das funções. Um filtro permite ver "Ativos", "Inativos" ou todos. Membros inativos aparecem na lista em cinza, com etiqueta "Inativo" e opção de reativar.

## Tela de inativação (como no exemplo enviado)

Ao clicar em "Inativar", abre uma janela em duas partes:

1. **Revise os itens pertencentes ao usuário** — lista contada do que está em aberto hoje:
   - Negócios em aberto (não ganhos nem perdidos)
   - Leads em aberto
   - Clientes da carteira (onde ele é responsável)
   - Tarefas e atividades pendentes
   - Conversas do RoyZapp ainda não encerradas
   Cada linha mostra a quantidade e pode ser marcada/desmarcada.

2. **Novo responsável** — um único seletor de pessoa que recebe tudo que foi marcado.

A inativação **não exige** transferir: se sobrar pendência sem dono, o membro fica marcado em **laranja** na lista, com aviso "Pendências não transferidas (N)", e o gestor pode abrir a mesma janela depois para concluir a transferência.

Ao confirmar: o acesso dele é encerrado (não consegue mais entrar) e os itens marcados passam para o novo responsável.

## O que nunca muda

Histórico permanece com o nome dele: atividades já feitas, mensagens, negócios ganhos/perdidos, comissões, tarefas concluídas, check-ins, logs. A transferência mexe somente em quem é o responsável **atual** de itens ainda abertos.

## Auditoria

Cada inativação e cada transferência ficam registradas: quem executou, data e hora, quem foi inativado, quem recebeu, e quantos itens de cada tipo mudaram de dono. Aparece nos logs do sistema (Administração → Auditoria) e também resumido dentro da própria janela, como histórico daquele membro.

## Detalhes técnicos

- Reaproveita a função existente `admin-manage-user` (ação `set_active`), que já bane o acesso, marca `users.is_active=false`, força relogin e grava em `audit_logs`.
- Nova ação `transfer_open_items` na mesma função (service role, restrita a super admin, com o mesmo padrão de auditoria):
  - `deals`: `responsible_user_id`/`sdr_user_id` onde `status` não é ganho/perdido
  - `leads`: `responsible_user_id` de leads não convertidos/descartados
  - `clients`: `responsible_user_id` (e `sales_user_id` quando marcado) de clientes ativos
  - `internal_tasks`: `assigned_to` com status pendente/em andamento/atrasada
  - `deal_activities`: atividades não concluídas
  - conversas RoyZapp: agente atribuído em atendimentos não encerrados
  - Nenhuma tabela de histórico (`audit_logs`, `lead_timeline`, `commission_deal_entries`, mensagens, check-ins) é tocada.
- Prévia por contagem: uma ação `count_open_items` retorna os números exibidos na etapa 1, com as mesmas regras usadas na transferência (mesma consulta, sem divergência entre o que é mostrado e o que é movido).
- Registro em `audit_logs` com `action='user.open_items_transferred'`, `entity_type='user'`, `details` contendo origem, destino e a contagem por tipo; a janela lê esses registros para montar a linha do tempo.
- UI em `src/components/settings/TeamManager.tsx` (cartões, filtro, badge laranja, botão Inativar/Reativar) + novo componente `DeactivateUserDialog.tsx` em `src/components/settings/`.
- A marcação laranja vem do cálculo em tempo real das pendências dos usuários inativos, sem coluna nova no banco.
