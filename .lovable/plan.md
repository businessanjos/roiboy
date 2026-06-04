
# Plano — A Melhor Área de Eventos da Internet

## Estado atual (já existe)
EventDetail.tsx já tem abas: Geral, Agenda, Checklist, Brindes, Custos, Notas, Participantes, Equipe, Mídia, Feedback. Vou **aproveitar e turbinar** o que existe — não recriar.

## O que vamos construir

### 🧩 Por evento — turbinar 4 abas
| Aba | Hoje | Vai virar |
|---|---|---|
| **Geral → Briefing** | Form básico | Briefing completo: objetivo, KPIs, público-alvo, tema, mood board, orçamento previsto vs realizado, links de referência |
| **Agenda → Run of Show** | Lista simples | Timeline minuto a minuto com horários, blocos, responsável por bloco, tipo (palestra/break/logística), notas |
| **Mídia → Galeria** | Upload básico | Álbuns por evento + tags + favoritos + **link público compartilhável** pros participantes baixarem |
| **NOVA: Design** | — | Híbrido: upload de versões finais (PDF/PNG) + links externos (Figma/Drive). Categorias: crachás, plaquinhas, slides, banners, identidade. Status: WIP / Em aprovação / Aprovado |

### 🌐 Áreas globais novas (sidebar do setor Eventos)
1. **Calendário Anual** (`/events/calendar`) — visão de ano inteiro, filtros por tipo/status, mini-cards com KPIs do evento
2. **Inventário** (`/events/inventory`) — totens, banners, backdrops, com status (estoque / em uso / danificado), histórico de uso por evento, fotos
3. **Playbooks** (`/events/playbooks`) — templates por tipo de evento (Workshop, Imersão, Lançamento) com checklist + cronograma + lista de fornecedores recomendados. Ao criar evento novo, escolhe um playbook e ele preenche tudo
4. **Dashboard Anual** (`/events/dashboard`) — KPIs agregados: custo médio por participante, NPS médio, ROI, total de eventos, gasto vs orçado por trimestre

## Estrutura de banco

```text
event_design_files       (id, event_id, account_id, category, name, file_url|external_url, status, version, uploaded_by)
event_media_albums       (id, event_id, account_id, name, public_token, is_public, cover_url)
event_media_items        (id, album_id, event_id, type[photo|video], url, thumb_url, is_favorite, tags[])
event_run_of_show        (id, event_id, start_time, end_time, title, block_type, responsible_user_id, notes, order_index)
event_briefing           (id, event_id, account_id, objective, kpis jsonb, target_audience, theme, mood_board_urls[], budget_planned, references jsonb)
event_inventory_items    (id, account_id, name, category, status, photo_url, qty, location, notes)
event_inventory_usage    (id, inventory_id, event_id, checked_out_at, returned_at, condition_returned)
event_playbooks          (id, account_id, name, event_type, description, default_checklist jsonb, default_schedule jsonb, recommended_supplier_ids[])
```

Mais 1 bucket de storage: `event-files` (privado, RLS por account_id) para design e mídia.

Página pública nova: `/public/event-album/:token` — visualizador de galeria sem login.

## Fases de entrega

### Fase 1 — Fundação + Design + Galeria (essa entrega)
- Migration com todas as 8 tabelas + bucket
- Aba **Design** nova (upload híbrido)
- **Galeria** turbinada (álbuns + link público)
- Página pública do álbum

### Fase 2 — Briefing + Run of Show
- Aba Geral vira Briefing completo
- Aba Agenda vira Run of Show minuto a minuto

### Fase 3 — Áreas globais
- Calendário Anual + Inventário + Playbooks + Dashboard
- Adiciona itens no sidebar do setor `eventos`
- Botão "Usar Playbook" ao criar evento

## Por que em fases
Cada fase é entregável de forma independente — você testa, dá feedback, e a próxima já vem ajustada. Tudo de uma vez seria 15+ arquivos novos sem você conseguir validar nada no caminho.

---

Aprovando esse plano, começo já pela **Fase 1**.
