# Negócios visíveis só para o responsável (com liberação pelo gestor)

## O que muda para o usuário
- Um vendedor comum passa a ver **só os próprios negócios**: abertos, ganhos e perdidos. Isso vale em todas as abas do pipeline, nos Leads, na busca, nos painéis, nas exportações e nos links diretos.
- Se ele tentar abrir um negócio de outra pessoa por qualquer caminho (busca de lead, link, conversa do RoyZapp, histórico do cliente), o negócio não abre. Aparece o aviso "Este negócio está com outro responsável".
- "Próprio" quer dizer que a pessoa é o **responsável**, o **vendedor (closer)**, o **SDR** ou o **responsável pela renovação** do negócio.
- Admins, super admins, quem também é admin e gestores (Head, Gerente, Diretor e Financeiro, a mesma regra do "Marcar pago") continuam vendo tudo.
- Transferir o negócio para alguém libera o acesso na hora, como acontece nas conversas do RoyZapp.

## Liberação pelo gestor
Em Configurações > Permissões, cada usuário ganha o bloco **"Visibilidade de negócios"**, com três caixinhas independentes:
- Ver negócios **abertos** de toda a equipe
- Ver negócios **ganhos** de toda a equipe
- Ver negócios **perdidos** de toda a equipe

Todas vêm desmarcadas, ou seja, cada um vê só os seus. O gestor marca quando quiser liberar, e desmarca para tirar o acesso de novo.

## Detalhes técnicos
1. **Tabela nova `user_deal_visibility`**, com account_id, user_id, can_view_open, can_view_won e can_view_lost, os GRANTs, RLS e as políticas (só gestor ou admin altera; cada usuário lê a própria linha).
2. **Função `can_view_deal(deal)`** (SECURITY DEFINER). Libera se a pessoa for admin ou gestor (reaproveitando a lógica de `can_manage_spiff_payments`), se for o responsável, closer (sales_user_id), SDR ou responsável pela renovação, ou se tiver a liberação para o status do negócio (open, won ou lost).
3. **RLS de `deals`**: trocar a política de SELECT, que hoje libera a conta inteira, por `account_id = conta AND can_view_deal(...)`. UPDATE e DELETE seguem a mesma regra. Com isso, busca, pipeline, dashboards e o MCP ficam protegidos de uma vez, porque todos leem pelo banco.
4. **Tabelas ligadas ao negócio** (`deal_activities`, `deal_field_values`, `deal_operation_briefings`): passam a exigir que a pessoa possa ver o negócio pai.
5. **Leads**: um lead que tem negócio só aparece para quem pode ver esse negócio. Leads sem negócio seguem a regra atual. Antes de aplicar, vou conferir se existe `responsible_user_id` em leads.
6. **Edge functions que usam service role** (ex.: get-lead-won-deals, list-pipelines): conferir quem está chamando e aplicar o mesmo filtro.
7. **Frontend**: o `DealDetailSheet` mostra o aviso quando o negócio vem vazio pela RLS. O novo `DealVisibilityManager` fica no AdminPermissionsTab, no mesmo modelo do RoyZappViewAccessManager.
8. **Validação**: conferir no banco, simulando um usuário comum (Darlan), que ele só enxerga os próprios negócios e que o acesso muda quando a caixinha é marcada. Também conferir que o gestor continua vendo tudo.

## Ponto de atenção
Vendedores que hoje usam relatórios da equipe inteira (ranking, SPIFFs) vão ver só os números deles, a menos que o gestor libere. As telas de ranking e SPIFFs que precisam dos totais da equipe passam a ler um resumo agregado, sem abrir os negócios.
