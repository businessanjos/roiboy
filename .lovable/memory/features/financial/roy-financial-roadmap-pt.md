---
name: ROY Financial Roadmap (Omie replacement)
description: Blueprint substituição Omie + 15 demandas time financeiro. Fase 1 (governança/renegociação) e Fase 2 (importadores Cielo/cheque/banco) entregues.
type: feature
---

# ROY Financial Module

## Status de implementação

- ✅ **Fase 1** — Governança: enum `payment_status`, trava global de DELETE, botão Renegociar (RPC `renegotiate_installment`), histórico em `installment_events`.
- ✅ **Fase 2** — Importadores: edge functions `import-cielo-report`, `import-cheques`, `bank-webhook-receiver`. Tabelas `financial_import_batches`, `financial_import_rows`, `bank_webhook_events`. Campos de taxa de cartão em `installments` (`card_fee_amount`, `card_fee_percent`, `card_acquirer`, `card_brand`, `card_nsu`, `card_authorization_code`, `net_amount`). Página `/financial/importar` com abas Cielo/Cheques (upload XLSX/CSV → preview → aplicar baixa em massa via RPC `settle_installment_from_import`).
- 🟡 **Fase 3 (parcial)** — Plano de contas hierárquico (`financial_categories.parent_id` + `code`, trigger `prevent_financial_category_cycle`, categoria obrigatória em `financial_entries` via `require_financial_entry_category`, UI `/financial/plano-de-contas`). CRM de cobrança Kanban (`dunning_cases` + `dunning_case_events`, SLA por etapa, drawer com timeline, auto-fechamento ao pagar, RPC `generate_dunning_cases`, página `/financial/cobranca`). Trava fiscal NF: campos `nf_number/nf_series/nf_issued_at/nf_url/nf_status/nf_cancelled_at/nf_cancellation_reason` em `invoices`, RPC `issue_fiscal_invoice` (trava fatura + grava NF) e `cancel_fiscal_invoice` (admin, bloqueado se houver parcela paga). Trigger `invoices_enforce_immutability` agora também bloqueia alterar nf_number/nf_series/nf_issued_at após emissão. Coluna NF Fiscal na página `/financial/installments` com botão Faturar/badge usando `IssueFiscalInvoiceDialog`. Falta: régua de cobrança por método (WhatsApp/email/SMS), integração Notazz para emissão automática.
- ⏳ **Fase 4** — Quitação automática de contrato, badge "Quitado — pronto para renovação", status automatizado em campos customizados.

## Importadores (Fase 2) — detalhes

- **Cielo**: matching por NSU (score 1) → fallback por valor + due_date ±15d em parcelas `cartao` não pagas (score 0.7). Headers reconhecidos no CSV/XLSX: Data, Valor, Valor Líquido, Taxa, Bandeira, NSU, Código de Autorização, Cliente.
- **Cheques**: matching por valor + due_date ±30d em parcelas `cheque` não pagas. Aplicar baixa marca `payment_status = 'cheque_recebido'`.
- **Webhook bancário** (`/functions/v1/bank-webhook-receiver`): público, protegido por header `x-webhook-secret` (env `BANK_WEBHOOK_SECRET`). Payload `{source, external_id, amount, occurred_at, reference?, payment_status?}`. Dedupe por `(source, external_id)`. Se `reference` for UUID de installment, baixa direto; senão tenta match por valor+data ±10d em `boleto`/`pix`. PIX → `pix_confirmado`, boleto → `boleto_pago`.

## Aguardando

- Maikol liberar Fase 3 (plano de contas + Kanban cobrança + NF fiscal Notazz).
- Definir banco para webhook (Itaú, Inter, Bradesco têm payloads diferentes — receiver atual é genérico).
- Configurar secret `BANK_WEBHOOK_SECRET` quando integrar primeiro banco.

Doc operacional detalhado em `.lovable/financial-roadmap.md`.
