---
name: RoyZapp Dashboard de Produtividade
description: Aba Produtividade no ROY zAPP (view=analytics) restrita a admins e Heads, com métricas por área e detecção de risco
type: feature
---
Aba **Produtividade** dentro do ROY zAPP (`/roy-zapp?view=analytics`).

Acesso (regra decidida em 11/08/2026): apenas **admins de conta** (`role admin/super_admin`, `is_also_admin`) e **Heads reais** (cargo com head/diretor/sócio) + gestor com cargo "Admin" (Andréia). Ficam de fora: gestor "Administrativo" (Arthur), `member` com cargo Admin (Darlan, Felipe Tester).
- Front: `src/lib/royZappAnalyticsAccess.ts` (`canViewZappAnalytics`) — usado no `ZappSidebarNav` e no `useRoyZappViewAccess` (injeta a view `analytics` em `allowedViews`).
- Banco: `public.zapp_can_view_analytics()` replica a mesma regra. Alterar sempre os dois juntos.

Escopo: gestor vê só as áreas liberadas para ele (regra de `canOpenZappSectorFor`); admins veem todas + opção "Todas as áreas".

Dados: RPC `public.zapp_productivity_metrics(_sector_id, _from, _to)` (SECURITY DEFINER, escopo por `account_id`) devolve JSON com mensagens in/out, tempo médio/mediana/p90 de resposta, % em até 5 min, engajamento, conversas sem resposta (>24h), conversas silenciosas, clientes ativos que nunca escreveram, menções de risco + amostras, produtividade por atendente, série por dia e por hora (America/Sao_Paulo).

Tempo de resposta = intervalo entre a última mensagem do cliente e a primeira resposta do time (descarta gaps > 48h).

Menções de risco: palavras-chave (cancelar, pausar, trancar, desistir, reembolso, estorno, rescisão, insatisfação) + botão "Analisar com IA" → edge function `zapp-analytics-ai` (Lovable AI, gemini-2.5-flash) que classifica risco real vs falso positivo.

Período padrão: mês atual.
