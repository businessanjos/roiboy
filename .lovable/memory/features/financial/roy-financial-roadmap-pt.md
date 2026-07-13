---
name: ROY Financial Roadmap
description: Módulo financeiro nativo do ROY. Integração Omie foi 100% removida — dados vêm de Comercial (deals) e CS (contratos) + lançamentos manuais.
type: feature
---

# ROY Financial Module

## Origem dos dados

- **Contratos ganhos no Comercial** → geram parcelas e `financial_entries` (source='contract').
- **Lançamentos manuais** feitos direto no financeiro (source='manual').
- **Importadores**: Cielo (XLSX/CSV) + cheques + webhook bancário genérico.
- **Open Finance via Pluggy** para conciliação de saldos e extratos.
- ❌ **Omie foi removido por completo** (tabelas `omie_settings`, `omie_integration_logs`, colunas `omie_*` em `financial_entries`, edge functions `sync-omie`, `create-omie-os`, `omie-*`, páginas `FinancialOmieIntegrationPage`, `FinancialTaxPage` e todo o módulo Tributário/Contador que dependia de `omie_settings_id`). Não recriar.

## Status atual

- ✅ Governança: enum `payment_status`, trava global de DELETE, botão Renegociar (RPC `renegotiate_installment`), histórico em `installment_events`.
- ✅ Importadores Cielo/Cheque/webhook bancário (tabelas `financial_import_batches`, `financial_import_rows`, `bank_webhook_events`; RPC `settle_installment_from_import`).
- ✅ Plano de contas hierárquico (`financial_categories.parent_id + code`, trigger anti-ciclo, categoria obrigatória em `financial_entries`, página `/financial/plano-de-contas`).
- ✅ Kanban de cobrança (`dunning_cases` + `dunning_case_events`, SLA por etapa, RPC `generate_dunning_cases`, página `/financial/cobranca`).
- ✅ NF fiscal: campos em `invoices`, RPCs `issue_fiscal_invoice` / `cancel_fiscal_invoice`, trigger `invoices_enforce_immutability`, coluna na página `/financial/installments`.
- ✅ Multi-CNPJ com `omie_settings` foi descontinuado. Financeiro opera single-tenant por `account_id`; se precisar voltar a multi-CNPJ, criar tabela nova (`financial_companies` ou similar), não reusar `omie_settings`.

## Aguardando

- Régua de cobrança por método (WhatsApp/email/SMS) integrada aos `dunning_cases`.
- Integração Notazz para emissão automática de NFS-e.
- Quitação automática de contrato + badge "Quitado — pronto para renovação".
