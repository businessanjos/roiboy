

## Reduzir frequencia dos crons horarios

### Situacao atual

| Job | Schedule atual | Frequencia |
|-----|---------------|------------|
| check-ai-usage-limits-hourly (jobid 9) | `0 * * * *` | A cada hora (24x/dia) |
| process-cx-moments (jobid 10) | `0 * * * *` | A cada hora (24x/dia) |
| process-scheduled-reminders (jobid 11) | `0 * * * *` | A cada hora (24x/dia) |

**Total: 72 invocacoes/dia**

### Nova frequencia proposta

| Job | Novo schedule | Frequencia | Justificativa |
|-----|--------------|------------|---------------|
| check-ai-usage-limits-hourly | `0 */6 * * *` | A cada 6h (4x/dia) | Monitoramento de custos nao precisa ser granular |
| process-cx-moments | `0 */4 * * *` | A cada 4h (6x/dia) | Momentos CX (aniversarios etc) tem janela diaria |
| process-scheduled-reminders | `0 */3 * * *` | A cada 3h (8x/dia) | Lembretes agendados precisam de mais pontualidade |

**Total: 18 invocacoes/dia (75% de reducao)**

### Implementacao

Executar 3 comandos SQL via `cron.alter_job` para atualizar os schedules:

```text
cron.alter_job(9, '0 */6 * * *')  -- AI usage: cada 6h
cron.alter_job(10, '0 */4 * * *') -- CX moments: cada 4h
cron.alter_job(11, '0 */3 * * *') -- Reminders: cada 3h
```

Nenhum arquivo de codigo precisa ser alterado. Apenas os schedules dos crons no banco.

