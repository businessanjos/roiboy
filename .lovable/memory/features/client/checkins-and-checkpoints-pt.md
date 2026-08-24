---
name: Checkpoints quinzenais e registro de contatos (CS)
description: Tabela client_checkins, cadência de 15 dias, painel /clients/checkpoints e resumo diário por IA das conversas do RoyZapp
type: feature
---

- Tabela `public.client_checkins`: `happened_at`, `initiated_by` (consultor | cliente), `channel` (whatsapp, ligacao, reuniao...), `kind` (checkpoint | contato), `summary` (uma frase), `source` (manual | ai_whatsapp), `message_count`.
- Cadência: checkpoint a cada 15 dias. Status calculado em `src/lib/cs/checkins.ts` (Em dia / Atenção / Vencido). Painel em `/clients/checkpoints` (menu Customer Success).
- A ficha do cliente mostra `ClientCheckinsCard` acima da Timeline; os registros entram na Timeline com `type: "checkin"`.
- Automação: edge function `cs-whatsapp-daily-summary` roda diariamente às 02:00 UTC (pg_cron `cs-whatsapp-daily-summary`), lê `zapp_conversations` + `zapp_messages` (não grupos, com `client_id`), gera resumo de uma frase via Lovable AI (gemini flash) e insere um check-in `source = ai_whatsapp` por cliente/dia (deduplicado).
- Importante: `message_events` está congelada desde abril/2026 — a fonte viva de mensagens é `zapp_messages`.
