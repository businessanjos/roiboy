---
name: NFS-e Emission (Notazz) — Sprint NF-1
description: Emissão de NFS-e dentro do ROY via Notazz. CNPJ emissor único auto-provisionado da conta. Trigger automático on_payment.
type: feature
---

# NFS-e dentro do ROY (Notazz)

## Decisões base
- **1 CNPJ emissor único** auto-provisionado a partir de `accounts.document` (CNPJ do cadastro da conta). Usuário NÃO cadastra CNPJ de novo na área fiscal.
- **Regime de caixa**: emite quando a parcela é paga (`nfse_emission_mode='on_payment'`).
- **Provider**: Notazz. Arquitetura pronta para `focus_nfe` no futuro.

## Auto-provisionamento (CRÍTICO)
- Função `public.ensure_default_contratada(p_account_id)` cria automaticamente a `contratada` padrão usando dados de `accounts` (CNPJ, nome, endereço) se não existir nenhuma.
- Chamada pela página `/financial/configuracoes/fiscal` ao abrir e pela edge `nfse-issue` antes de emitir.
- A página fiscal mostra os dados read-only vindos de `accounts` + campos puramente fiscais editáveis (IM, regime, item LC 116, alíquota ISS, código tributação municipal).
- **NUNCA** pedir CNPJ/razão social na área fiscal — sempre puxar de `accounts`. Se faltar CNPJ na conta, mostrar alerta com link para `/settings?tab=profile`.

## Schema
- `contratadas` — CNPJs emissores (auto-criados). Multi-CNPJ tecnicamente possível mas a UI sempre opera no padrão único.
- `nfse_issuances` — uma linha por tentativa de emissão.
- `account_settings.nfse_emission_mode`, `nfse_auto_email`, `nfse_default_contratada_id`.
- Bucket privado `fiscal-docs` isolado por `account_id/`.

## Edge functions
- **nfse-issue**: aceita `{installment_id}` ou `{invoice_id}` ou `{issuance_id}`. Deduplicação por source. Monta payload Notazz e envia.
- **nfse-webhook** (`verify_jwt=false`): recebe callback Notazz, atualiza status por `externalId`.
- Secret: `NOTAZZ_API_KEY`.

## UI
- **`/financial/configuracoes/fiscal`** — 3 abas: **Empresa Emissora** (read-only de accounts + campos fiscais), **Regras de Emissão**, **Provedor/Webhook**.
- **`<EmitirNFButton installmentId? invoiceId?>`** — botão reutilizável já integrado em `/financial/parcelas`.

## Pendente
- Cron `nfse-status-poll` para casos sem webhook.
- Cancelamento (`nfse-cancel`) com motivo.
- Aba "Emissões (Notazz)" em `/financial/notas-fiscais`.
- Retenções PJ (IR/INSS/CSLL/PIS/Cofins).
