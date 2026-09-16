# Limite de tempo no log de ações

Recomendação: **180 dias** (6 meses) visíveis na aba. É o ponto de equilíbrio — cobre um semestre inteiro de histórico comercial, sem deixar a tela pesada. Nada é apagado: os registros continuam gravados e eu consigo consultar qualquer período quando você precisar.

## O que muda na tela

- A aba de logs passa a mostrar apenas registros dos últimos 180 dias.
- Os filtros de período continuam: 7, 30 e 90 dias, mais a opção "6 meses" como máximo.
- Um aviso discreto no topo informa que a tela mostra até 6 meses e que períodos anteriores podem ser consultados sob demanda.
- A exportação em planilha continua funcionando, respeitando o período escolhido.

## O que não muda

- Nenhum registro é apagado do banco.
- Nenhuma regra de acesso muda: a aba segue restrita a administradores e gestores.
- As fontes seguem as mesmas: ações em negócios (etapa, ganho, perdido, notas, anexos, exclusão) e tarefas, sempre com autor gravado.

## Detalhes técnicos

- Em `src/components/admin/AuditLogViewer.tsx`: adicionar `"180"` ao mapa `PERIOD_DAYS` e ao seletor de período, e fixar um teto rígido de 180 dias no cálculo de `sinceIso`, aplicado às três consultas (`audit_logs`, `deal_activities`, `deals` excluídos).
- Manter os `limit` por fonte já existentes.
- Adicionar linha de texto auxiliar abaixo dos filtros explicando o teto de 6 meses.
- Sem migração de banco, sem job agendado, sem exclusão de dados.
