---
name: Ryka Onboarding Provisioning
description: Botão no ClientOnboardingDrawer cria conta Ryka com senha aleatória + WhatsApp via Operações
type: feature
---

Provisionamento de acesso ao sistema Clínica Ryka (https://rykasystem.com) direto do `ClientOnboardingDrawer` em `/operations/onboarding`.

- **Disparo**: apenas botão manual no card do cliente (sem automação por etapa/ganho).
- **Elegibilidade**: cliente precisa ter produto `Rykas Mentoring` ou `Eternum Club` em `client_products`.
- **Edge function**: `provision-ryka-access` gera senha temporária (12 chars), envia `client.created` para `CLINICA_RYKA_WEBHOOK_URL` com `data.temp_password`, headers `x-api-key: CLINICA_RYKA_API_KEY`.
- **WhatsApp**: usa `whatsapp_integrations` ativa do setor de Operações (fallback: primeira ativa). Endpoint `${api_url}/send/text` com header `token`.
- **Auditoria**: tabela `client_ryka_provisions` (account_id, client_id, email, phone, status, ryka_response, whatsapp_status, whatsapp_error, triggered_by). RLS por `account_id`.
- **Pré-requisitos do cliente**: `emails[0]` válido + `phone_e164`.
- **Dependência cruzada**: projeto Ryka (`d626b41f-65ce-41f8-9924-eebc9585fd86`) precisa ler `data.temp_password` em `roycx-webhook` → `createClinicFromRoy` ao invés de senha hardcoded `Ryka@2026`.
