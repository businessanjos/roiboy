# Histórico de ações do comercial no log de Configurações

## O que existe hoje

Os registros já são gravados, mas ficam em lugares separados:

- Dentro de cada negócio: mudança de etapa, ganho/perdido, notas, anexos e ligações, com autor e data (2.079 mudanças de etapa nos últimos 60 dias).
- Log de Configurações: apenas tarefas, eventos e alguns registros de pessoas (mais de 16 mil nos últimos 60 dias).
- Ligações 3C: registro próprio com vendedor, contato, duração e gravação.
- Negócio excluído: guarda quem excluiu e quando.

Falta uma visão única. Quem abre o log em Configurações hoje não enxerga nada de negócios nem de ligações.

## O que será feito

Ampliar o log já existente em Configurações para incluir o comercial, sem criar tela nova.

1. **Negócios no log**: cada mudança de etapa, ganho, perdido, nota, anexo e exclusão de negócio passa a aparecer na mesma lista, mostrando quem fez, quando, qual negócio e o que mudou (etapa anterior para nova etapa, motivo da perda etc.).
2. **Ligações no log**: ligações da 3C entram como uma linha por chamada, com vendedor, contato, duração e resultado.
3. **Filtros**: por período, por pessoa, por tipo de registro (negócio, tarefa, ligação, evento, pessoa) e por tipo de ação, além da busca por texto já existente.
4. **Acesso restrito**: a aba continua visível somente para gestores e administradores; vendedores não têm acesso.
5. **Exportação**: baixar o resultado filtrado em planilha, para conferência de metas e auditoria.

## Detalhes técnicos

- `AuditLogViewer.tsx` (aba "logs" em `Admin.tsx`) passa a consultar três fontes e unificá-las numa lista ordenada por data: `audit_logs`, `deal_activities` (tipos `stage_change`, `status_change`, `note`, `image`, `call`) e `threecplus_call_logs`.
- Cada fonte é normalizada para um formato comum: `quando`, `quem`, `ação`, `tipo de registro`, `nome do registro`, `detalhe` (usando `old_value`/`new_value` de `deal_activities`).
- Nomes de usuário resolvidos em lote por `users.id` → `name`/`email`; nome do negócio via `deals.title`, respeitando `deleted_at`.
- Paginação por data (janela padrão de 30 dias) para não carregar tudo de uma vez; consultas com `limit` explícito por fonte.
- Restrição de acesso reaproveita o gate atual de admin/gestão já usado na página Admin; nenhuma política de banco é alterada.
- Exportação em CSV no cliente, a partir do resultado já filtrado.
