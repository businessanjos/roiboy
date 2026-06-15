# Gestão Tech — Setup automático por projeto

ROY puxa MRR, assinantes, receita 30d e tokens AI diretamente de cada projeto.
Cada projeto monitorado expõe um endpoint `roy-metrics` (edge function) que ROY
chama via `tech-projects-sync` (manual ou via cron).

## Como conectar um novo projeto

1. No projeto a ser monitorado, criar a edge function `roy-metrics` (templates
   em `docs/gestao-tech/templates/`).
2. Criar um secret `ROY_METRICS_TOKEN` (string aleatória) no projeto monitorado
   **e** em ROY (mesma string em ambos).
3. Em ROY, cadastrar o projeto em **Gestão Tech → Novo projeto** com:
   - **Metrics endpoint**: `https://<project-ref>.supabase.co/functions/v1/roy-metrics`
   - **Token secret name**: `ROY_METRICS_TOKEN` (ou o nome que cadastrou em ROY)
4. Clicar em sincronizar.

## Projetos monitorados

| Projeto | Endpoint | Template |
|---|---|---|
| Ever AI | `https://idjbeggntdvkfucubcou.supabase.co/functions/v1/roy-metrics` | `templates/ever-ai.ts` |
| NEW CLINICA RYKA | `https://<ref>.supabase.co/functions/v1/roy-metrics` | `templates/clinica-ryka.ts` |
| ROY PRIVATE | `https://<ref>.supabase.co/functions/v1/roy-metrics` | `templates/roy-private.ts` |

## Payload esperado

```json
{
  "mrr_cents": 1234500,
  "arr_cents": 14814000,
  "active_subscriptions": 87,
  "new_subscriptions": 4,
  "churned_subscriptions": 1,
  "revenue_last_30d_cents": 2100000,
  "ai_tokens_30d": 12345678,
  "ai_cost_cents_30d": 4500,
  "currency": "BRL"
}
```

Qualquer campo ausente é tratado como zero.
