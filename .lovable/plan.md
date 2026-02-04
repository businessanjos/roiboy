
# Configuração de CRON para Lembretes de Agenda

## Objetivo
Agendar a execução automática da Edge Function `check-agenda-reminders` todos os dias às 08:00 da manhã (horário de Brasília).

---

## Implementação

### Passo 1: Habilitar Extensões Necessárias

Precisamos garantir que as extensões `pg_cron` e `pg_net` estejam habilitadas:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

### Passo 2: Criar o CRON Job

O job será configurado para executar às 08:00 no fuso horário de Brasília (UTC-3 = 11:00 UTC):

```sql
SELECT cron.schedule(
  'check-agenda-reminders-daily',   -- Nome do job
  '0 11 * * *',                     -- 11:00 UTC = 08:00 BRT
  $$
  SELECT net.http_post(
    url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/check-agenda-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Detalhes Técnicos

| Configuração | Valor |
|--------------|-------|
| Nome do Job | `check-agenda-reminders-daily` |
| Expressão CRON | `0 11 * * *` (11:00 UTC) |
| Horário Local | 08:00 BRT (Brasília) |
| Frequência | Diariamente |
| Endpoint | `/functions/v1/check-agenda-reminders` |

### Expressão CRON Explicada

```text
0 11 * * *
│ │  │ │ │
│ │  │ │ └── Dia da semana (0-6, * = todos)
│ │  │ └──── Mês (1-12, * = todos)
│ │  └────── Dia do mês (1-31, * = todos)
│ └───────── Hora (0-23, UTC)
└─────────── Minuto (0-59)
```

---

## Resultado Esperado

Após a configuração:
1. Todo dia às 08:00 (horário de Brasília), o sistema chamará automaticamente a função
2. Usuários receberão notificações de:
   - Tarefas que vencem hoje
   - Tarefas atrasadas
   - Eventos agendados para hoje
   - Eventos não realizados

---

## Verificação (Opcional)

Para verificar os jobs agendados:

```sql
SELECT * FROM cron.job;
```

Para ver o histórico de execuções:

```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```
