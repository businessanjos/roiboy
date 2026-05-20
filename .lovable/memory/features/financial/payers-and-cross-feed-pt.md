---
name: Payers and Financial Cross-feed (Sprint 1 + 4)
description: Sistema de Pagadores separados de Clientes + trigger de quitação automática de contrato + write-off por cancelamento + badge "pronto para renovar".
type: feature
---

# Pagadores + Cross-feeding Financeiro ↔ Operação

## Pagador (Sprint 1)

Pagador (`payers`) é quem paga; Cliente (`clients`) é quem usa. Tabela `client_payers` faz N:N com `is_default`.

- **CRUD**: `/financial/pagadores` (FinancialPayersPage)
- **Selector reutilizável**: `<PayerSelector value onChange clientId allowCreateFromClient />` em `src/components/financial/payers/`
- **Form modal**: `<PayerFormDialog>` valida CPF (11) / CNPJ (14)
- **RPC `ensure_payer_from_client(client_id)`**: cria payer self a partir de `clients.cpf_cnpj` + `name` + `emails[1]` + `phone`, vincula como default. Lança erro se CPF/CNPJ vazio.
- **Feature flag**: `account_settings.payer_required_in_won` (default false). Quando true, wizard de Ganha vai exigir Payer.

## Quitação automática (Sprint 4)

- Trigger `trg_check_invoice_settlement` em `installments` AFTER INSERT/UPDATE de status/payment_status/paid_at.
- Quando todas as parcelas da invoice são `paid` ou (`cheque_recebido`/`pix_confirmado`/`boleto_pago`/`cartao_capturado`), invoice → `settled` + `closed_at`.
- Quando todas as invoices do `deal_id` viram settled, `client_contracts.payment_status = 'quitado'`.
- Eventos `invoice_settled` e `contract_settled` em `installment_events`.

## Write-off por cancelamento

- Trigger `trg_handle_contract_cancellation` BEFORE UPDATE OF status em `client_contracts`.
- Status terminais: `cancelled`, `dismissal_termination`, `dropout_7d`.
- Parcelas `pending`/`scheduled`/`overdue` da invoice associada (via `deal_id`) viram `written_off` com nota e evento `cancellation_writeoff`.

## Badges na ficha do cliente

- `<ContractRenewalBadge clientId>` (verde com Crown): aparece quando há contract com `payment_status='quitado'`. Em `src/components/client/`.
- `<ClientOverdueBadge clientId>` (vermelho/laranja): wrapper de `useClientFinancialStatus` para o header da ficha individual. Difere do `<OverdueBadge status>` (batch, usado na tabela `/clients`).
- Botão "Renegociar" no header → navega para `/financial/installments?client_id=<id>`.

## Schema novo

- `account_settings.payer_required_in_won` (bool, default false) — feature flag wizard
- `account_settings.block_overdue_days` (int nullable) — bloqueio operacional opcional
- `clients.overdue_exception_until` (date nullable) — exceção administrada
- `client_contracts.payment_status` text NOT NULL default 'ativo' — check: ativo|quitado|inadimplente|cancelado|renegociado
- `installment_events.event_type` agora aceita: invoice_settled, contract_settled, cancellation_writeoff

## Wizard "Marcar como Ganha"

- `RequiredFieldsModal` já cria/atualiza `payers` + vínculo `client_payers` (is_default=true) a partir de `BillingMentoreeSection` quando `outcomeType !== 'lost'`. Erros de payer não bloqueiam o ganho (apenas logam).

## Pendente (próximas rodadas)

- Aba "Pagadores" dedicada na ficha do cliente
- Bloqueio operacional quando `block_overdue_days` configurado
- Migração de dados legados clients→payers (script de backfill)
