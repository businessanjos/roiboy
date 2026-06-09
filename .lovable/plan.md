## Visão geral

Transformar `/marketing` (calendário) no **hub central** que conecta:

```text
                  ┌─────────────────────┐
                  │  Calendário (hub)   │
                  └──────────┬──────────┘
        ┌────────────┬───────┼───────┬─────────────┐
        ▼            ▼       ▼       ▼             ▼
   Projetos      Tasks    Pautas   Posts       Campanhas
  (marketing_  (marketing_(content_(content_   (meta_campaign
   projects)    tasks)    pieces /  platform_   _alerts /
                          marketing_posts)      ad_sets)
                          _ideas)
```

Cada evento vira um "objeto-âncora" do qual nascem entregáveis de conteúdo, com IA opcional para gerar pautas, e tudo aparece sobreposto no mesmo calendário (camadas filtráveis).

---

## Fase 1 — Visão unificada no calendário (base visual)

Sem novas tabelas. Sobrepor camadas no `MonthlyCalendarView` e `YearlyCalendarView`:
- **Eventos** (já existe)
- **Posts/Pautas** de `content_pieces` e `marketing_ideas` (campo `scheduled_at`/`publish_date`)
- **Tasks** de `marketing_tasks` (campo `due_date`)
- **Marcos de projeto** de `marketing_project_milestones` (`target_date`)
- **Janelas de campanha** Meta de `meta_campaign_alerts` (período `start_date`→`end_date`)

UI:
- Toolbar com toggles de camada (Eventos / Pautas / Tasks / Marcos / Campanhas) e cor distinta por camada (badge + barra lateral colorida no item).
- Clique no item abre a sheet correspondente já existente (reusa `MarketingEventSheet`, drawer de task, etc.).
- Item compacto: ícone da camada + título + horário/projeto.

Hook novo `useMarketingCalendarLayers(year, month)` que faz fetches paralelos e devolve `Record<dateKey, LayerItem[]>`.

---

## Fase 2 — Checklist de conteúdo por evento

Nova tabela `event_content_deliverables`:
- `event_id` (FK events)
- `kind` ('teaser' | 'save_the_date' | 'reels' | 'carrossel' | 'stories' | 'email' | 'cobertura_ao_vivo' | 'pos_evento' | 'custom')
- `title`, `description`
- `due_offset_days` (negativo = antes do evento, positivo = depois)
- `due_date` (calculado: `scheduled_at + due_offset_days`)
- `status` ('todo' | 'in_progress' | 'done' | 'cancelled')
- `assigned_to` (FK users)
- `marketing_task_id` (FK opcional — quando virar task no board)
- `content_piece_id` (FK opcional — quando virar pauta no editorial)

UI:
- Nova aba "Conteúdo" dentro de `MarketingEventSheet` com:
  - Botão **"Aplicar template padrão"** (cria automaticamente: D-30 save the date, D-14 teaser, D-7 reels, D-1 stories, D+0 cobertura, D+3 pós).
  - Lista editável (status, responsável, datas).
  - Botão por item: **"Criar task"** (insere em `marketing_tasks`) e **"Criar pauta"** (insere em `content_pieces`).
- Esses deliverables aparecem na camada "Pautas/Tasks" da Fase 1.

Templates configuráveis por `event_type` em `account_settings` (JSONB).

---

## Fase 3 — Sugestões de IA por evento

Edge function `suggest-event-content` (já existe `suggest-marketing-event-field` como referência) usando Lovable AI Gateway (`google/gemini-3-flash-preview`).

Input: evento (`title`, `description`, `goals`, `event_type`, `scheduled_at`) + `marketing_brand_voice` + `marketing_personas` + últimas `content_strategies` + `content_pillars`.

Output estruturado (zod):
```ts
{
  deliverables: [{
    kind, title, hook, big_idea, format,
    due_offset_days, channel, persona_target
  }]
}
```

UI:
- Botão **"✨ Gerar pautas com IA"** na aba Conteúdo do evento.
- Modal preview com as sugestões editáveis (toggle "incluir"/"editar").
- Confirmar → cria deliverables (+ opcional cria pautas em `content_pieces` direto).

---

## Fase 4 — Auto-criação no editorial e integração com campanhas

- Trigger no `events`: ao criar/editar evento marcado como `auto_generate_content = true`, aplica template padrão (Fase 2) automaticamente.
- Ao marcar deliverable como `done` com `content_piece_id`, marcar a pauta como produzida.
- Camada de **campanhas Meta** mostra janelas D-7/durante/D+3 do evento sugeridas em `meta_campaign_alerts` (apenas leitura cruzada — sem criar campanhas).
- Indicador de saúde no card do evento: "3/8 entregáveis prontos" com barra de progresso.

---

## Detalhes técnicos

- **Tabelas novas**: `event_content_deliverables` (Fase 2), `event_content_templates` opcional (ou JSONB em `account_settings`).
- **RLS**: `account_id` herda do evento; políticas `authenticated` com `has_role`.
- **Performance**: `useMarketingCalendarLayers` usa `Promise.all` com `select` mínimo (id, title, date, color) — não puxa colunas pesadas.
- **Reuso**: posts já têm `MarketingEventSheet`-like drawers; tasks usam o drawer existente de `marketing_tasks`. Sem duplicar UI.
- **Sem migrações na Fase 1** — começamos com mudança puramente visual para você validar UX antes de criar schema.

---

## Ordem de entrega

1. ✅ **Fase 1** (camadas + filtros no calendário) — entregue.
2. ✅ **Fase 2** (checklist + tabela `event_content_deliverables` + seção "Conteúdo" no sheet) — entregue.
3. **Fase 3** (botão IA + edge function).
4. **Fase 4** (auto-criação + integração com Meta + indicadores).

Cada fase é independente e testável.