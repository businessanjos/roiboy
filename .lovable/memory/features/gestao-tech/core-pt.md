---
name: Gestão Tech (substitui Ever IA)
description: Painel /gestao-tech consolidando faturamento, recorrência, tokens AI e custo por projeto monitorado
type: feature
---
- Página `/gestao-tech` substitui Ever IA na sidebar (sector `gestao-tech`).
- Tabelas: `tech_projects` (config) e `tech_project_snapshots` (snapshot diário).
- Sincronização tem 2 modos por projeto:
  1. `metrics_endpoint` preenchido → edge function `tech-projects-sync` chama o `roy-metrics` do projeto remoto (header `x-roy-token` lido do secret `metrics_token_secret_name`).
  2. Sem endpoint → fallback `tech-stripe-sync` lê do Stripe via `stripe_secret_name`.
- Cron diário `tech-projects-daily-sync` (06:00 UTC) faz `sync_all` automático.
- Projetos pré-cadastrados: Ever AI, NEW CLINICA RYKA, ROY PRIVATE — secrets esperados `ROY_METRICS_TOKEN_EVER_AI`, `ROY_METRICS_TOKEN_CLINICA_RYKA`, `ROY_METRICS_TOKEN_ROY_PRIVATE`.
- Templates da edge function `roy-metrics` por projeto em `docs/gestao-tech/templates/`. Cada projeto monitorado precisa colar o template adaptado e criar o secret `ROY_METRICS_TOKEN`.
