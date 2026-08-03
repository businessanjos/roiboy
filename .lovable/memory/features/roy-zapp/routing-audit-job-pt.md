---
name: Auditoria diária de roteamento de conversas do RoyZapp
description: Job pg_cron que detecta conversas com external_message_id de outra instância (ex. CS rotulada como Comercial) e corrige canal/setor registrando evidências
type: feature
---

Função `public.audit_zapp_conversation_routing(p_dry_run, p_min_messages, p_min_ratio, p_limit)` (SECURITY DEFINER).

Como funciona:
- Monta o mapa prefixo -> integração por voto de maioria: prefixo = `split_part(external_message_id, ':', 1)` (número da instância que originou a mensagem).
- Para cada conversa, calcula o prefixo dominante. Se >= `p_min_messages` (5) mensagens e ratio >= `p_min_ratio` (0.8) e a integração esperada difere de `zapp_conversations.integration_id`, marca como divergência.
- Corrige `integration_id` e `sector_id` da conversa; move os assignments abertos para o departamento do setor correto (`status = 'triage'`, `agent_id` nulo) ou encerra os do setor errado quando já existe atendimento aberto no setor certo.
- Registra evidência em `public.zapp_routing_audit_log` (prefixo detectado, integração/setor anterior e esperado, contagem de mensagens do prefixo e total, ação, ratio).

Cron: job `audit-zapp-conversation-routing-daily`, diário às 03:20 UTC, chamando a função com `p_dry_run = false`.
Modo simulação: `select public.audit_zapp_conversation_routing(true);` (não altera nada, retorna amostra das divergências).
