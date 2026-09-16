# Histórico de ações do comercial no log de Configurações

## Só entra o que é confiável

Conferi a origem de cada registro antes de propor. Entra no log apenas o que tem autor gravado em 100% dos casos:

| Registro | Autor identificado | Entra? |
|---|---|---|
| Mudança de etapa do negócio (2.079 em 60 dias) | 100% | Sim |
| Ganho / perdido do negócio (730) | 100% | Sim |
| Negócio excluído (84) | 100% | Sim |
| Tarefas criadas, concluídas, editadas, excluídas (16 mil) | 100% | Sim |
| Notas e anexos no negócio (3.080) | 80% | Sim, mas só as linhas com autor |
| Ligações 3C (29.702 em 30 dias) | 12,5% | Não |

As ligações ficam de fora: em 30 dias, 25.984 de 29.702 chamadas não têm vendedor vinculado, porque a maioria vem da discagem automática da 3C sem vínculo com usuário do ROY. Colocar isso no log daria uma leitura errada de produtividade. Se quiser, trato a correção desse vínculo como tarefa separada e só então incluo as ligações.

## O que será feito

Ampliar a aba de log que já existe em Configurações, sem criar tela nova.

1. **Ações de negócio no log**: mudança de etapa (etapa anterior para nova etapa), ganho, perdido com o motivo, exclusão do negócio, notas e anexos — sempre com quem fez, quando e em qual negócio.
2. **Ações de tarefa**: continuam como hoje (criada, concluída, editada, excluída), agora na mesma lista ordenada por data.
3. **Filtros**: período, pessoa, tipo de registro (negócio ou tarefa) e tipo de ação, além da busca por texto já existente.
4. **Acesso restrito**: visível apenas para administradores e gestores. Vendedor não acessa.
5. **Exportação**: baixar o resultado filtrado em planilha.
6. **Nada é inventado**: quando um registro antigo não tiver autor gravado, ele simplesmente não aparece — nunca será atribuído a alguém por suposição.

## Detalhes técnicos

- `AuditLogViewer.tsx` (aba "logs" em `Admin.tsx`) passa a unificar duas fontes numa lista ordenada por data: `audit_logs` e `deal_activities` restrito a `type in ('stage_change','status_change','note','image')` com `user_id is not null`.
- Negócios excluídos entram de `deals` com `deleted_at is not null` usando `deleted_by` como autor.
- Normalização para um formato comum: `quando`, `quem`, `ação`, `tipo`, `registro`, `detalhe` (a partir de `old_value`/`new_value`).
- Nomes resolvidos em lote por `users.id` → `name`/`email`; título do negócio por `deals.title`.
- Janela padrão de 30 dias com `limit` explícito por fonte e paginação por data, para não carregar tudo de uma vez.
- Restrição de acesso reaproveita o gate de admin/gestão já usado na página Admin; nenhuma política de banco é alterada.
- Exportação em CSV no cliente, a partir do resultado já filtrado.
