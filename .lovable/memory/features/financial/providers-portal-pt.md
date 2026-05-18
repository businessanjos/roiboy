---
name: Portal de Prestadores (NFs mensais)
description: Link público por prestador para envio mensal de NF e atualização de dados bancários/PIX
type: feature
---

# Portal do Prestador de Serviços

Permite que prestadores (PJ) cadastrados em `hr_service_providers` enviem NFs mensais e
mantenham seus dados de pagamento atualizados via link público (sem login).

## Tabelas

- `hr_service_providers.portal_token` (uuid único, default `gen_random_uuid()`) — token do link.
- `hr_service_providers.preferred_payment_day` (int 1–31) — dia preferido para vencimento.
- `hr_provider_invoices` — registra NFs por competência. Único por `(provider_id, competence_month)`.
  - Status: `pending | approved | rejected | paid`. `payment_due_date` é calculado pela edge function quando há `preferred_payment_day`.

## Rotas

- **Pública (sem auth)**: `/portal/prestador/:token` → `PublicProviderPortal`.
- **Interna (Financeiro)**: `/financial/prestadores` → `FinancialProvidersPortalPage`.
  - Aba "NFs recebidas": aprovar/rejeitar/marcar como paga, download via signed URL.
  - Aba "Prestadores & links": copiar/abrir link único do portal.

## Edge function

- `provider-portal` (verify_jwt = false). Ações:
  - `GET ?action=get&token=...` → profile + últimas 24 NFs.
  - `POST ?action=update_profile` → atualiza dados bancários, PIX, dia de pagamento, contato.
  - `POST ?action=upload_invoice` → grava NF em `provider-invoices/{account_id}/{provider_id}/...`.
- Usa SERVICE_ROLE — toda autorização é validada pelo token.

## Storage

- Bucket privado `provider-invoices`. Leitura via `createSignedUrl` (10 min).
- Limite 15MB por arquivo. Aceita PDF/PNG/JPG.
