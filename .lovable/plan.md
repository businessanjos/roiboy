# Histórico de atividade do comercial, em Insights

Tirar o histórico de vendas de dentro das Configurações do sistema e dar a ele um lugar próprio dentro de Insights, focado no que os vendedores fazem — visível apenas para gestores e administradores.

## O que muda

### 1. Nova página em Insights
- Item "Atividade da equipe" no menu de Insights, dentro de Vendas.
- Aparece somente para gestor/admin. Vendedor, consultora, marketing e demais usuários não veem o item e, se digitarem o endereço, são redirecionados — mesma regra já usada no Painel de Vendas.
- A aba em Configurações continua existindo para o log geral do sistema, sem misturar com o comercial.

### 2. Só atividade comercial
- Entram: negócios (criado, movido de etapa, ganho, perdido, nota, anexo, excluído) e tarefas/atividades de vendas (criada, concluída, editada, excluída), sempre com o lead/negócio ligado.
- Saem da tela: eventos, RH, marketing, formulários, produtos, configurações e demais áreas.

### 3. Seleção de pessoa mais fácil
- Um seletor de vendedor no topo, com busca por nome, listando quem realmente aparece no período — em vez de depender só da caixa de busca livre.
- Continua existindo a busca por texto para procurar por nome de lead ou de negócio.

### 4. Cores para diferenciar
- Cada linha ganha destaque de cor pela ação: criação em verde, conclusão em azul, mudança de etapa em roxo, exclusão em vermelho, nota/anexo em cinza.
- Barra colorida na lateral da linha e rótulo da ação na mesma cor, para bater o olho e entender.

### 5. Filtro de período com "Hoje"
- Opções: Hoje, Últimos 7 dias, Últimos 30 dias, Últimos 90 dias, Últimos 6 meses (padrão continua 30 dias).

O que já existe continua: descrição em frase ("Criou tarefa 'Ligação não atendida' — Lead Fulano"), detalhes sem dados técnicos, exportação em planilha e o teto de 6 meses na tela.

## Detalhes técnicos

- Extrair o conteúdo de `src/components/admin/AuditLogViewer.tsx` para um componente compartilhado com uma propriedade `scope`: `"commercial"` (negócios + tarefas) e `"system"` (comportamento atual). A aba de Configurações passa a usar `scope="system"`; a nova página usa `scope="commercial"`.
- No escopo comercial, as consultas ficam restritas a `deal_activities`, `deals` (criados/excluídos) e `audit_logs` com `entity_type = 'task'`; o seletor de tipos some e o seletor de ação lista só as ações que existem nesse escopo.
- Nova rota `/insights/atividade-comercial` em `src/App.tsx`, com guarda `isManagementUser(currentUser, isSuperAdmin)` e `Navigate` para `/insights` quando não autorizado.
- Item de menu adicionado em `src/config/sectors.ts` (setor `vendas`) e filtrado em `src/hooks/useSectorNavItems.ts` pela mesma checagem de gestão já aplicada a `/sales-dashboard`.
- Seletor de pessoa alimentado pelos próprios registros carregados (lista distinta de `user_id` + nome), sem consulta extra.
- Cores via tokens semânticos existentes (`success`, `danger`, `primary`, `muted`), sem cor fixa no componente.
- Período "Hoje" calculado a partir do início do dia local; nenhuma alteração de banco, política de acesso ou dado.
