

## Mover auto-suggest e client analysis para fila assincrona

### Status: ✅ CONCLUÍDO

### O que foi feito

1. **Migração de banco**: Adicionadas colunas `job_type TEXT` e `payload JSONB` na `ai_analysis_queue`. `message_id` tornado nullable.

2. **Webhook**: Removidos 2 blocos `setTimeout` (~120 linhas) e substituídos por 2 INSERTs na fila (~20 linhas cada):
   - `client_suggest` - auto-suggest client links
   - `client_analysis` - avatar update, conversations upsert, message_events, lead lookup

3. **process-ai-queue**: Refatorado com 3 handlers por `job_type`:
   - `ai_analysis` - comportamento original
   - `client_analysis` - lógica movida do webhook
   - `client_suggest` - lógica movida do webhook

### Resultado

- Webhook: 0 setTimeouts, apenas queries síncronas + INSERTs na fila
- Toda lógica pesada processada em batch pelo cron
