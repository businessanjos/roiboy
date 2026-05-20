---
name: content-hq
description: Área Head de Conteúdo multi-plataforma (Bruna e Everton) em /marketing/content-hq com estratégia, pilares, calendário, pautas/briefings com IA, kanban de produção, biblioteca e performance.
type: feature
---

# Content HQ — Head de Conteúdo Multi-Plataforma

**Rota:** `/marketing/content-hq` (nav Marketing, ícone Crown).

**Talentos padrão:** Bruna e Everton (seedados em `content_talents` para todas as `accounts`). Estrutura permite adicionar mais.

**Plataformas suportadas:** Instagram, YouTube (long+Shorts), TikTok, Threads, LinkedIn, Pinterest, Spotify (podcast).

**Sidebar interna (7 seções):** Estratégia → Pilares → Calendário → Pautas & Briefings → Produção (Kanban) → Biblioteca → Performance.

**Tabelas:**
- `content_talents` (account_id, slug, niche default 'estetica', brand_voice)
- `content_strategies` (talent_id + year + quarter UNIQUE; positioning, audience, tone, goals jsonb, big_bets jsonb)
- `content_pillars` (mix_percentage, platforms text[], `reference_links` jsonb — coluna `references` é palavra reservada, NÃO usar)
- `content_pieces` (platform, status, scheduled_date, hook/script/cta/caption/hashtags/thumbnail_brief, briefing jsonb, ai_generated)
- `content_library_items` (hook|cta|hashtag|reference|idea)
- `content_platform_accounts` (talent_id+platform UNIQUE, external_id, access_token, status pending|connected|error|revoked, last_sync_at)
- `content_platform_posts` (posts reais sincronizados por plataforma; UNIQUE platform_account_id+external_id)
- `content_platform_metrics` (snapshot histórico por post: views, reach, likes, comments, shares, saves, engagement_rate, avg_watch_seconds)
- `content_platform_metric_snapshots` (snapshot diário por canal: followers, total_views; UNIQUE platform_account_id+snapshot_date)

**Edge function `content-metrics-sync`:** lê accounts conectadas e busca posts+métricas em:
- Instagram: Meta Graph v20 `/me/media` + `/insights` (requer IG Business User ID + long-lived access token)
- YouTube: Data API v3 (Channel ID + API Key)
- TikTok: Display API `/v2/video/list` (access_token OAuth)
Dispara via `syncPlatformAccount([accountId])` da UI Performance. Sem cron por padrão.

**RLS:** Acesso por `account_id` via `public.users` (auth_user_id = auth.uid()).

**Status do kanban:** backlog, script, shooting, editing, approval, scheduled, published.

**IA — edge function `content-hq-ai`** (Lovable AI Gateway, model `google/gemini-3-flash-preview`):
- `generate_strategy` — posicionamento + pilares sugeridos para o trimestre
- `generate_pautas` — lote de pautas por pilar+plataforma (cria N rows em backlog)
- `generate_briefing` — roteiro, CTA, legenda, hashtags, thumbnail brief e notas de produção

System prompt sempre injeta nicho **estética** + brand voice do talento + boas práticas da plataforma (PLATFORM_TIPS map).

**Hook único:** `src/hooks/useContentHQ.tsx` exporta tipos, `PLATFORMS`, `PIECE_STATUSES`, queries (useTalents, usePillars, useStrategy, useContentPieces), mutations (useUpsertStrategy/Pillar/Piece, useDeletePillar/Piece) e `callContentHQAI()`.

**Componentes:** `src/components/marketing/content-hq/ContentHQ{Strategy,Pillars,Calendar,Briefings,Kanban,Library,Performance}.tsx`.

**Regra:** Bruna e Everton são talentos fixos da Eternum no nicho estética. Não deletar os seeds.
