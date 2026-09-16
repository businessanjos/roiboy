# Log de ações: prazo de exibição e o que mais incluir

## 1. Prazo na aba

Recomendação: **180 dias** (6 meses) visíveis na tela. Cobre um semestre inteiro sem deixar a aba pesada. Nada é apagado — os registros continuam no banco e eu consigo consultar qualquer período quando você pedir.

- Filtros de período: 7, 30, 90 dias e 6 meses (máximo).
- Aviso discreto no topo: a tela mostra até 6 meses; períodos anteriores sob consulta.
- Exportação em planilha continua, respeitando o período escolhido.

## 2. O que mais dá para incluir com precisão total

Conferi as fontes reais dos últimos 60 dias. Entra apenas o que tem autor gravado em 100% dos casos:

- **Usuários e permissões** — usuário desativado, perfil de acesso alterado. Hoje fica escondido no meio do log; passa a ter tipo próprio "Usuário".
- **Eventos** — criação, edição e exclusão de evento, com autor.
- **Clientes** — exclusão de cliente, com autor.

Fica de fora (não tem autor confiável, entraria como informação errada):

- **Ligações 3C** — só 12,5% têm vendedor vinculado (a maioria vem da discagem automática).
- **Ligações na linha do tempo do lead** — 588 de 1.705 com autor (34%).
- **Criação de negócio** — o sistema não grava quem criou; só o responsável atual, que muda depois.

## 3. Opcional (recomendo)

Passar a gravar **quem criou cada negócio** de agora em diante. Hoje essa informação se perde. Com isso, daqui a alguns meses o log passa a mostrar também "Fulano criou o negócio X" com precisão total. Não afeta nada existente e não altera negócios antigos.

## Detalhes técnicos

- `src/components/admin/AuditLogViewer.tsx`: adicionar `"180"` ao `PERIOD_DAYS` e ao seletor; teto rígido de 180 dias no cálculo de `sinceIso`, aplicado às três consultas (`audit_logs`, `deal_activities`, `deals` excluídos); texto auxiliar abaixo dos filtros.
- Ampliar o mapa de tipos/ações para rotular `entity_type` `user`, `event` e `client` e as ações `user.deactivated` / `user.access_profile_changed` em português; excluir o ruído automático `hr_collaborators / auto_heal_inactive`.
- Opcional (item 3): migração adicionando `created_by uuid` em `deals` com preenchimento automático na criação, e nova fonte no log quando houver dados.
- Sem exclusão de dados e sem job agendado.
