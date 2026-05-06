---
name: Typeform integration
description: Tracks Typeform forms with Personal Token; webhook auto-installed per form for realtime responses; matches by email/phone to leads/deals; funnel: visits→starts→completed→lead→won
type: feature
---
Integration lives at /marketing/trafego-pago → aba "Typeform".

Tables: `typeform_forms` (forms rastreados), `typeform_responses` (responses + matched_lead_id/matched_deal_id), `typeform_form_stats` (snapshots de Insights API).

Edge functions:
- `typeform-manager` (auth obrigatória): list_typeform_forms, add_form (instala webhook automaticamente), remove_form, refresh_form, get_dashboard
- `typeform-webhook` (público, valida HMAC SHA-256 via header `Typeform-Signature` com `TYPEFORM_WEBHOOK_SECRET`): recebe form_response e dá upsert em typeform_responses + match

Matching: email (ilike) primeiro, fallback telefone (sufixo de 9 dígitos normalizados) contra `leads` e `deals` da mesma conta.

Secrets: `TYPEFORM_PERSONAL_TOKEN` (escopos forms:read, responses:read, webhooks:write), `TYPEFORM_WEBHOOK_SECRET` (string aleatória definida pelo usuário).

Webhook URL pattern: `https://{ref}.supabase.co/functions/v1/typeform-webhook?account_id={uuid}` — instalado por form com tag `roy-{first8ofAccountId}`.
