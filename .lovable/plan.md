# Formulários Roy para Campanhas

Construir um sistema próprio de formulários para campanhas de tráfego pago, reaproveitando a tabela `forms` existente, com URL pública (`/f/:slug`), tracking de funil, captura de UTM, matching com lead/deal e heatmap de abandono por campo. Convive lado a lado com a aba Typeform atual.

## 1. Banco de dados (1 migration)

**Extensão de `public.forms`:**
- `slug text` único por conta — usado em `/f/:slug`
- `is_campaign boolean default false` — distingue formulário de campanha
- `campaign_meta jsonb default '{}'` — defaults (cor, logo, CTA, redirect pós-envio)

**Nova `public.form_sessions`** (1 linha por visitante):
- `id, account_id, form_id, session_token` (cookie/localStorage)
- `landed_at, started_at, completed_at` (timestamps do funil)
- `utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, user_agent, ip_hash, country`
- `response_id uuid` (set quando completa)
- `last_field_id text, fields_seen int, total_seconds int`
- Index por `(account_id, form_id, landed_at)`

**Nova `public.form_field_events`** (granular para heatmap):
- `id, session_id, form_id, field_id, event` (`focus|blur|change|skip`), `at`, `seconds_on_field`
- Index por `(form_id, field_id)`

**Extensão de `public.form_responses`:**
- `session_id uuid`, `email text`, `phone text`, `matched_lead_id uuid`, `matched_deal_id uuid`, `match_method text`, `utm_source/medium/campaign/content/term text`, `landed_at, submitted_at`

**RLS + GRANTs:** sessions e events ficam públicas para INSERT (anon) — formulário sem login — e SELECT só authenticated da conta. Lookup de slug é público.

## 2. Edge Functions

- **`get-campaign-form`** (público): resolve slug → retorna form + campos (reusa lógica de `get-public-form`).
- **`track-campaign-form`** (público): aceita `{ event, session_token, form_id, field_id, utm, ... }`. Faz upsert em `form_sessions` e insert em `form_field_events`. Eventos: `view, start, field_focus, field_blur, complete`.
- **`submit-campaign-form`** (público): insere em `form_responses` com session_id; marca session `completed_at`; roda matching email/telefone contra `leads`/`deals` (reusa helpers `canonicalEmail`, `phoneVariants` do typeform-webhook); responde redirect_url.

## 3. Frontend

**Rota pública nova `/f/:slug`** (`src/pages/PublicCampaignForm.tsx`):
- Wizard estilo Typeform (uma pergunta por tela, progress bar, transições).
- Captura UTMs da URL no mount.
- Gera `session_token` em localStorage; dispara `view` no mount, `start` no primeiro foco, `field_focus`/`field_blur` por campo, `complete` no submit.
- Suporta tipos básicos de `custom_fields` (text, email, phone, select, multi-select, textarea, number).

**Aba nova "Formulários Roy" em `/marketing/trafego-pago`** (`src/components/marketing/CampaignFormsTab.tsx`):
- Lista de formulários da conta (`is_campaign = true`) com badge ativo, slug copiável (link `/f/:slug`), contagem de submissões últimos 30d.
- Botão "Novo formulário" → dialog: título, descrição, slug, seleção dos `custom_fields` que comporão o wizard, aparência (cor primária, logo, mensagem final/redirect).
- Botão "Ver analytics" por formulário abre dashboard.

**Dashboard de analytics** (`src/components/marketing/CampaignFormAnalytics.tsx`):
- **Cards de funil:** Views → Iniciados → Completos (+ % conversão entre etapas).
- **Tempo médio total** e **tempo médio por campo**.
- **Heatmap de abandono:** tabela por campo com `% de quem viu` × `% que abandonou` × `tempo médio`.
- **Origens (UTM):** breakdown por `utm_source`/`utm_campaign` com taxa de conversão.
- **Matching:** quantos respondentes viraram lead, deal, e quantos chegaram a `won` (lookup pelo `matched_lead_id`/`matched_deal_id` → `deals.status='won'`).
- Período filtrável (7d/30d/90d/custom).

A aba Typeform permanece intacta ao lado.

## 4. Detalhes técnicos

```text
Public flow:
  /f/:slug
    └─ get-campaign-form           (slug → form+fields)
    └─ track-campaign-form         (view → start → field_focus/blur → complete)
    └─ submit-campaign-form        (response + match + redirect)

Auth flow:
  /marketing/trafego-pago → "Formulários Roy"
    └─ list/create/edit (forms WHERE is_campaign)
    └─ analytics view (sessions + responses + field_events)
```

- Matching de lead/deal reusa `_shared/email-normalize.ts` e `_shared/phone-normalize.ts` (mesma lógica do typeform-webhook).
- `session_token` é UUID v4 gerado client-side; serve só para deduplicar eventos da mesma sessão, sem PII.
- `ip_hash` armazenado com SHA-256 (LGPD-safe) só para detectar bots.
- Aparência segue tokens do design system (sem cores hardcoded).
- Não removo nada do Typeform; aba e edge functions atuais ficam.

## 5. O que NÃO faz parte (pode vir depois)

- Embed em sites externos via iframe/script.
- A/B testing entre versões do mesmo formulário.
- Webhook outbound para n8n/Zapier ao receber resposta.
- Migração automática das respostas históricas do Typeform.

Quando aprovar, eu rodo a migration e implemento na sequência.