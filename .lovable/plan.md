
# Head de Conteúdo Multi-Plataforma (Bruna & Everton)

Nova área dentro de **Marketing** que centraliza toda a estratégia de conteúdo de Bruna e Everton em 4 frentes: YouTube (long + Shorts), TikTok, Instagram (Reels/Feed/Stories) e Threads/LinkedIn/Pinterest/Spotify (podcast). Cobre os 3 níveis: **estratégico → tático → operacional**, com IA gerando pilares, pautas e briefings ancorados no nicho de **estética**.

## Arquitetura da área

Nova rota `/marketing/content-hq` (Content Headquarters) com sidebar vertical interna:

```text
Marketing > Content HQ
├── 1. Estratégia        (Porquê fazer)
├── 2. Pilares            (O que fazer)
├── 3. Calendário         (Quando fazer — multi-plataforma)
├── 4. Pautas & Briefings (Como fazer — operacional detalhado)
├── 5. Produção (Kanban)  (Execução: ideia → roteiro → grav → edição → publicado)
├── 6. Biblioteca         (Hooks, CTAs, referências, brand voice)
└── 7. Performance        (Métricas consolidadas por talento × plataforma)
```

Acesso fixo aos dois talentos via seletor topo: **Bruna | Everton | Ambos**.

## Conteúdo de cada seção

**1. Estratégia** — Por talento: posicionamento, público-alvo (avatar de estética), tom de voz, objetivos trimestrais (awareness, autoridade, conversão), big bets por plataforma. Editável + versionável.

**2. Pilares de conteúdo** — 4–6 pilares por talento (ex: "Procedimentos faciais", "Bastidores", "Casos antes/depois", "Educação técnica para colegas", "Lifestyle médico"). Cada pilar tem: descrição, % de mix ideal, plataformas onde performa, exemplos de referência.

**3. Calendário Editorial Multi-Plataforma** — Visão semanal/mensal com swimlanes por plataforma. Cada card = um conteúdo planejado (talento, pilar, plataforma, formato, data, status, responsável operacional). Drag-and-drop entre datas.

**4. Pautas & Briefings (IA)** — Para cada conteúdo: gancho, roteiro/estrutura, CTA, hashtags, thumbnail brief, descrição/legenda otimizada por plataforma. Botão **"Gerar com IA"** que considera: talento, pilar, plataforma, nicho estética, brand voice salva. Sempre editável.

**5. Produção (Kanban)** — Colunas: `Backlog → Roteiro → Gravação → Edição → Aprovação → Agendado → Publicado`. Cada card puxa o briefing da seção 4.

**6. Biblioteca** — Brand voice por talento, banco de hooks que funcionam, CTAs testados, referências (URLs), hashtags por pilar.

**7. Performance** — Conecta com o que já existe (Instagram, TikTok, YouTube). Adiciona consolidado **por talento × pilar × plataforma**, taxa de execução do calendário (planejado vs publicado).

## Camada de IA (Lovable AI)

Edge function `content-hq-ai` com 3 modos via `action`:
- `generate_strategy` — input: talento + objetivo trimestre → output: posicionamento + pilares sugeridos
- `generate_pautas` — input: talento + pilar + plataforma + qtd + período → output: lista de pautas com gancho
- `generate_briefing` — input: pauta + plataforma → output: roteiro completo, CTA, hashtags, thumb brief

Modelo padrão `google/gemini-3-flash-preview`. System prompt sempre injeta: nicho estética, brand voice do talento, boas práticas da plataforma.

## Modelo de dados (novas tabelas)

- `content_talents` — bruna, everton (seed inicial; estrutura permite adicionar)
- `content_strategies` — talent_id, quarter, year, positioning, audience, tone, goals (jsonb), big_bets (jsonb)
- `content_pillars` — talent_id, name, description, mix_percentage, platforms (text[]), references (jsonb)
- `content_pieces` — peça de conteúdo (talent_id, pillar_id, platform, format, scheduled_date, status, briefing jsonb, assigned_user_id, hook, cta, hashtags, caption, thumbnail_brief)
- `content_library_items` — talent_id, type (hook|cta|reference|hashtag), content, pillar_id, performance_score

RLS por `account_id` + sector marketing.

## Detalhes técnicos

- Sidebar vertical interna seguindo padrão `mem://style/universal-sidebar-navigation-pattern-pt`
- Plataforma badges com cores próprias (semantic tokens em index.css)
- Status do `content_pieces` com cores consistentes (Backlog cinza, Roteiro amber, Produção azul, Publicado verde)
- Calendário reutiliza componentes de `MonthlyCalendarView` adaptados
- Kanban reutiliza padrão dos Kanbans de pipeline existentes
- IA via Lovable AI Gateway, edge function única com `action` discriminador
- Sem mocks; dados reais desde o início (seed Bruna + Everton via migration)

## Escopo desta entrega

MVP cobre seções 1–5 + IA + sidebar. Seções 6 (Biblioteca) e 7 (Performance) entram como esqueleto navegável (UI sem analytics complexos), para iterar nas próximas rodadas.

## Memória

Criar `mem://features/marketing/content-hq-pt.md` consolidando: rota, talentos fixos, plataformas suportadas, modelo IA, tabelas, e regra de que Bruna e Everton são os talentos padrão da Eternum.
