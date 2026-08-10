---
name: Faturamento só após assinatura
description: Parcelas (invoices/installments) e lançamentos (financial_entries) só são gerados quando o contrato digital é confirmado como assinado
type: feature
---

# Gatilho de faturamento = assinatura do contrato digital

- Ao ganhar o deal, `SalesPipeline.tsx` cria o `client_contracts` com `receivables_generated = false` e apenas **prepara** o plano (`installments_count`, `first_due_date`, `installments_detail`). NÃO gera financeiro nesse momento.
- Quando `digital_contracts.status = 'signed'` (ou `signed_at` preenchido), o trigger `trg_digital_contract_signed_release_billing` → função `tg_digital_contract_signed_release_billing` marca `client_contracts.receivables_generated = true`.
- Isso dispara o trigger existente `contract_generate_receivables`, que roda `generate_contract_receivables` (financial_entries = Lançamentos) e `generate_contract_installments` (invoices + installments = Parcelas).
- Resolução do contrato: primeiro por `deal_id`, senão por `client_id` (+ `product_id` quando informado), sempre o mais recente ainda não faturado e não cancelado.
- Contratos sem assinatura digital continuam podendo ser liberados manualmente em `/financial/reconciliacao-vendas` ou na aba Negociação.
