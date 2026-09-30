# Agenda comercial do relatório diário: usar as atividades dos negócios

## O que está acontecendo
A seção "Agenda comercial" do relatório conta reuniões de uma tabela antiga de reuniões, que só tem 2 registros e não recebe nada desde março. Por isso ela sempre aparece zerada. O time registra as calls como **atividades nos negócios**. Só nos últimos 7 dias, foram 29 "Call Comercial Agendada", 13 "Call Comercial Concluída" e 9 "No-Show".

## O que muda no relatório
A seção passa a contar, pela data de vencimento das atividades dos negócios:
- **Calls do dia:** atividades "Call Comercial Agendada" que vencem no dia do relatório, mostrando quantas foram concluídas.
- **Calls concluídas:** atividades "Call Comercial Concluída" marcadas como feitas naquele dia.
- **No-shows do dia:** atividades "No-Show" do dia.
- **Agendadas para amanhã:** atividades "Call Comercial Agendada" que vencem no dia seguinte.

Exemplo:
```text
*AGENDA COMERCIAL*
• Calls do dia: *5* (concluídas: 3)
• No-shows: *1*
• Agendadas para amanhã: *4*
```

## Como conferir
Gerar o relatório em modo de teste (só o texto, sem mandar mensagem) para ontem e hoje, e comparar com as atividades no funil.

## Detalhes técnicos
- Arquivo: `supabase/functions/daily-sales-report-whatsapp/index.ts`, trocar as consultas em `sales_meetings` (linhas 71-72) por consultas em `internal_tasks` com join em `activity_types` (por nome, dentro da conta), `deal_id not null` e `due_date` = dia / dia+1 (data local BRT).
- "Concluída" = `completed_at` preenchido ou status customizado com `is_completed_status`.
- Deploy da função e teste com `dryRun: true`.
