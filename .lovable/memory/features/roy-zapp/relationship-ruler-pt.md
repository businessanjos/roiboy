---
name: Régua de Relacionamento RoyZapp
description: Cadências programadas de follow-up por WhatsApp no RoyZapp (modelos, inscrições, toques, dispatcher)
type: feature
---

Régua de relacionamento inspirada na da Clínica Ryka, disponível em todos os setores do RoyZapp (aba "Régua" na sidebar, view `ruler`).

- **Tabelas**: `zapp_ruler_templates` + `zapp_ruler_template_steps` (modelos), `zapp_ruler_enrollments` (contato inscrito), `zapp_ruler_touches` (toques agendados). RLS por `account_id` + `user_has_sector_access`.
- **Claim atômico**: RPC `claim_zapp_ruler_touches(p_limit)` restrita a `service_role`.
- **Dispatcher**: edge function `zapp-ruler-dispatcher`, cron `*/10 * * * *`. Respeita janela de envio (America/Sao_Paulo), cancela toques vencidos há mais de 24h (sem envio retroativo), cancela a régua se o contato respondeu (`stop_on_reply` via `zapp_messages.direction='inbound'`), delay aleatório 1.5-4s entre envios (anti-ban).
- **Híbrido**: `auto_send=true` envia via Uazapi `${host}/send/text`; `false` gera fila manual em "Fila de hoje" (copiar / feito / pular).
- **Presets fixos** em `RULER_PRESETS` (`src/hooks/useZappRulers.ts`): Curta, Padrão, Relacionamento CS, Longa. Sem sugestões de IA.
- **Variáveis** nas mensagens: `{nome}` e `{primeiro_nome}`.
- **Entrada**: botão CalendarClock no `ZappChatHeader` abre `ZappRulerEnrollDialog` para a conversa aberta.
- **Toques só de atividade**: cada passo tem `is_task`. Marcado, o toque não envia nada (`auto_send=false`, `message=''`) e vira tarefa manual na "Fila de hoje". `claim_zapp_ruler_touches` ignora `is_task = true`. Envio de mensagem é opcional por toque.
