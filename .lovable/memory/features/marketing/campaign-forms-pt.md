---
name: Campaign Forms (Formulários Roy)
description: Sistema próprio de formulários para campanhas de tráfego pago, em /marketing/trafego-pago aba "Formulários Roy", com URL pública /c/:slug e analytics estilo Typeform
type: feature
---
Substitui o Typeform internamente. Convive lado a lado com a aba Typeform atual.

**Tabela base:** `forms` extendida com `slug` (único por conta), `is_campaign bool`, `campaign_meta jsonb` (primary_color, redirect_url, thanks_message). Campos do wizard são `custom_fields` da conta referenciados pelo array `fields`.

**Tracking:** `form_sessions` (1 por visitante, com UTM, ip_hash SHA-256, user_agent, referrer, landed/started/completed, total_seconds, response_id) + `form_field_events` (focus/blur/change/skip/validation_error com seconds_on_field). RLS público para INSERT/UPDATE em sessions (anon), SELECT só authenticated da conta.

**Respostas:** `form_responses` ganhou `session_id`, `email`, `phone`, `matched_lead_id`, `matched_deal_id`, `match_method`, `utm_*`, `landed_at`. Matching reusa `canonicalEmail` + `phoneVariants`/`phoneCoreKey` dos shared helpers.

**Edge functions (todas públicas, verify_jwt=false):**
- `get-campaign-form?slug=X` → form + campos ordenados
- `track-campaign-form` (POST) — events: view/start/field_focus/field_blur/change/validation_error
- `submit-campaign-form` (POST) — insere response + match + completa session + retorna redirect_url/thanks

**Rotas:**
- `/c/:slug` — `src/pages/PublicCampaignForm.tsx` (wizard 1 pergunta por tela, Progress, UTM auto-captado da URL, sessionToken em localStorage)
- `/marketing/trafego-pago` aba "Formulários Roy" — `CampaignFormsTab` (CRUD) + `CampaignFormAnalytics` (funil views→starts→completos, tempo médio, conversão para won via deals.lead_id/matched_deal_id, abandono por campo, UTM breakdown)

NOTA: a rota `/f/:formId` é do PublicForm legado (UUID); campanhas usam `/c/:slug`.
