---
name: Fonte única de clientes ativos para Eventos
description: View public.event_active_clients + RPC search_active_event_clients definem os clientes elegíveis em Eventos/campanhas (produto ativo + status active/paused/churn_risk)
type: feature
---

Toda listagem de clientes em Eventos (participantes, campanhas de formulário/lembretes) deve usar a fonte única do backend:

- View `public.event_active_clients` (security_invoker) — clientes com pelo menos um vínculo ativo em `client_products` e `status IN ('active','paused','churn_risk')`.
- RPC `public.search_active_event_clients(p_search, p_limit)` — busca por nome/telefone sobre a view.

Nunca consultar `clients` diretamente para montar listas de convite/campanha de eventos, para não divergir da UI.
Exceção: `event-checkin` identifica o participante pelo telefone e não aplica o filtro (check-in presencial).
