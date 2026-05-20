# Sprint 1 + Sprint 4 — Plano de execução paralelo

Vamos virar a chave do Financeiro em duas frentes simultâneas. Toda a estrutura de banco para `payers`, `client_payers` e `invoices.payer_id` **já existe** — então Sprint 1 é principalmente UI/RPC, não migration pesada.

## Sprint 1 — Pagador (Payer) em toda criação de invoice

### Objetivo
Toda fatura criada (vinda de venda ganha, manual, ou upsell) precisa ter Pagador definido — pessoa/empresa que **paga** (CPF/CNPJ + razão social + endereço fiscal), separada do **cliente** (quem usa). Sem isso, Notazz não consegue emitir NF correta e migração Omie trava.

### Entregas

1. **`/financial/pagadores` — CRUD completo de Payers**
   - Listagem (busca por documento/nome), criar, editar, desativar
   - Form com validação CPF/CNPJ, autocomplete via ReceitaWS (já existe edge fn similar)
   - Visualização dos `client_payers` ligados (clientes que usam esse pagador)

2. **`PayerSelector` component reutilizável**
   - Combobox que busca payer existente do account
   - Botão "+ Novo pagador" abre dialog inline com mini-form
   - Opção "Usar dados do cliente como pagador" (cria payer automaticamente a partir de `clients.cpf_cnpj`/`name`)
   - Vincula automaticamente via `client_payers` (relationship: `self` | `spouse` | `company` | `parent` | `other`)

3. **Wizard "Marcar como Ganha" do Pipeline**
   - Hoje move o stage e cria contrato; vamos adicionar **etapa obrigatória "Faturamento"**:
     - Selecionar/criar Payer (default: pagador padrão do cliente, se existir)
     - Confirmar método de pagamento, nº parcelas, primeira vencimento, acquirer (se cartão)
     - Pré-visualizar split 70/30 (ou customizado por produto) entre serviço e produto
   - No submit cria `invoices` + `installments` já com `payer_id`, `payment_method`, `card_acquirer` corretos
   - Sem Pagador definido, não é possível ganhar o deal

4. **Criação manual de invoice em `/financial/invoices`**
   - Tornar `payer_id` obrigatório no form (hoje a coluna existe mas o form não força)
   - Mostrar pagador na listagem e nos drawers

5. **Aba "Pagadores" na ficha do cliente**
   - Lista todos os payers vinculados, marca o default, permite trocar/adicionar
   - Mostra histórico de invoices por pagador

### Não-objetivo desta sprint
- Notazz real (fica para Sprint 2)
- Split por produto configurável (usa default 70/30 já existente)

---

## Sprint 4 — Operação ↔ Financeiro bidirecional

### Objetivo
Fechar o loop: Operação enxerga inadimplência/quitação em tempo real; Financeiro recebe sinais de cancelamento/renegociação da Operação.

### Entregas

1. **Trigger de quitação automática de contrato**
   - DB function `check_invoice_settlement()` disparada após UPDATE em `installments`
   - Quando todas as parcelas da invoice viram `paid`/`cheque_recebido`/`pix_confirmado` → `invoices.status = 'settled'` + `closed_at = now()`
   - Quando todas as invoices de um `client_contracts` estão settled → set `client_contracts.payment_status = 'quitado'`
   - Emite `installment_events` tipo `contract_settled`

2. **Badge "Quitado — pronto para renovar"**
   - Componente `ContractRenewalBadge` (verde-âmbar) aparece em:
     - `/clients` (linha da tabela)
     - Ficha do cliente (header)
     - `/operations/renewals` (já tem detecção de 90d, agrega quitados)
   - Visível para CS/Ops/Closer

3. **Badge de Inadimplência na ficha do cliente**
   - Já existe `OverdueBadge` em `/clients`; replicar no header da **ficha individual**
   - Tooltip: "X parcelas em atraso, R$ Y total, vencida há Z dias"
   - Clique abre drawer de cobrança (`dunning_cases`)

4. **Hook de cancelamento de contrato → write-off proporcional**
   - Quando `client_contracts.status` vira `cancelado` ou `cancelado_judicial`:
     - Trigger calcula parcelas futuras (pending/scheduled) da invoice associada
     - Cria evento `installment_events` tipo `cancellation_writeoff` em cada
     - Atualiza `installments.status = 'written_off'` + razão = motivo do cancelamento
   - Edge function `cancel-contract-writeoff` (chamada por trigger via `pg_net` se preferir async)

5. **Renegociação no fluxo de Operação**
   - Drawer da parcela em `/financial/installments` já tem botão Renegociar
   - **Adicionar atalho na ficha do cliente** (aba Financeiro) para abrir o mesmo flow sem sair de Operação
   - CS pode renegociar sem virar Financeiro

6. **Bloqueio operacional opcional por inadimplência**
   - Setting `account_settings.block_overdue_days` (default null = desativado)
   - Quando configurado, cliente com parcelas vencidas > X dias mostra banner vermelho na ficha + bloqueia geração de novos contratos/upsells
   - Admin/Finance pode liberar exceção (campo `clients.overdue_exception_until`)

---

## Estrutura técnica (resumo)

```text
Sprint 1 (Pagador)
├── migration:
│   └── RPC `ensure_payer_from_client(client_id)` — cria payer self se não existir
├── edge fn (já existe lookup-cnpj? reaproveitar)
├── src/components/financial/payers/
│   ├── PayerSelector.tsx
│   ├── PayerFormDialog.tsx
│   ├── PayerList.tsx
│   └── ClientPayersTab.tsx
├── src/pages/financial/FinancialPayersPage.tsx
├── src/components/sales/wizard/
│   └── WonDealBillingStep.tsx  (nova etapa)
└── update: FinancialInvoicesPage form (payer obrigatório)

Sprint 4 (Cross-feeding)
├── migration:
│   ├── fn check_invoice_settlement() + trigger AFTER UPDATE installments
│   ├── fn handle_contract_cancellation() + trigger AFTER UPDATE client_contracts
│   ├── add client_contracts.payment_status enum (ativo|quitado|inadimplente|cancelado)
│   └── add clients.overdue_exception_until, account_settings.block_overdue_days
├── src/components/clients/
│   ├── ContractRenewalBadge.tsx
│   └── ClientOverdueBadge.tsx (extrai do que já existe)
├── src/components/clients/ClientDetailHeader.tsx (mostra badges)
└── src/components/clients/tabs/ClientFinancialTab.tsx (renegociar + histórico)
```

## Ordem de execução

1. **Migration única** com todos os triggers + RPCs novos (Sprint 1 + 4)
2. Componentes de Payer + página de pagadores
3. Wizard de Ganha com etapa Faturamento
4. Badges (renewal + overdue) na ficha do cliente
5. Atalhos de renegociação na ficha
6. Atualizar memórias: `payers-and-wizard-pt`, `contract-auto-settlement-pt`

## Riscos e mitigações

- **Triggers em massa**: usar `WHERE NEW.status IS DISTINCT FROM OLD.status` para evitar reprocesso. Logar tudo em `installment_events`.
- **Pagador inexistente em invoices antigas**: a coluna já é `NOT NULL`, então toda invoice atual já tem payer. OK.
- **Wizard quebrando vendas em produção**: feature flag inicial — etapa Faturamento opcional para admin testar, depois obrigatória.

## Pergunta antes de eu codar

Quer a **feature flag** na etapa Faturamento do wizard (eu lanço opcional e ligo depois) ou **já obrigatório** desde o primeiro deploy?
