
# Fase 2 — Popular Financeiro com dados reais (Vendas + Operações + Omie)

Hoje o `financial_entries` está praticamente vazio. As páginas (Fluxo de Caixa, Lançamentos, Parcelas, Recorrentes, DRE, Aging, Comissões etc.) leem dessa tabela, então só vão "ganhar vida" quando ela for populada. A estratégia é tratar `financial_entries` como **tabela‑espelho única** alimentada por 3 fontes:

```
[Operações: client_contracts] ──► gera parcelas (receivable)
[Vendas: deals won]           ──► gera receivable se ainda não houver contrato
[Omie: contas pagar/receber]  ──► sincroniza tudo (payable + receivable) por CNPJ
                                    │
                                    ▼
                          public.financial_entries
                                    │
                ┌───────────────────┼─────────────────────┐
                ▼                   ▼                     ▼
        Fluxo de Caixa        Lançamentos /         Operações:
        / DRE / Aging         Parcelas /            badge inadimplente
                              Recorrentes           + cheques pendentes
```

## 1. Schema (uma migration)

Adicionar em `financial_entries`:
- `company_id uuid` → fk `omie_settings(id)` (qual CNPJ)
- `source text` check in `manual|omie|contract|deal` default `manual`
- `source_id uuid` (deal_id, contract_id, etc.)
- `deal_id uuid` (atalho para Vendas)
- `omie_payload jsonb`
- `last_omie_sync_at timestamptz`
- índice único parcial `(account_id, omie_id) where omie_id is not null`
- índice `(account_id, source, source_id)`

Em `client_contracts`:
- (sem mudança de schema — já tem `receivables_generated`, `installments_detail`, `installments_count`, `first_due_date`, `payment_method`)

## 2. Geração automática de parcelas a partir de contratos (Operações)

Trigger `AFTER INSERT OR UPDATE` em `client_contracts`:
- Quando `receivables_generated = true` e ainda não existe nenhum `financial_entry` com `source='contract' AND source_id = contract.id`:
  - Criar N entries (`entry_type='receivable'`, `source='contract'`, `installment_number`, `total_installments`, `installment_group_id`, `due_date` calculada por mês, `client_id`, `contract_id`, `deal_id`, valor = `value / installments_count` ou `installments_detail[i].amount`).
- Quando contrato é cancelado/suspenso: marcar entries futuros pendentes como `cancelled` (sem deletar histórico).
- Backfill: rodar uma query única que cria entries para contratos antigos com `receivables_generated=true` e sem entries.

## 3. Sincronização Omie → financial_entries

Nova edge function `omie-sync-entries`:
- Aceita `{ company_id }`. Busca credenciais via `omie_settings`.
- Pagina `ListarContasReceber` e `ListarContasPagar` por mês (ex.: últimos 12m + próximos 12m), 500 ms entre chamadas (anti‑flood Omie 5001).
- Para cada título: upsert em `financial_entries` por `(account_id, omie_id)`:
  - mapeia status, valor, vencimento, pagamento, descrição, número doc, payload completo.
  - tenta ligar `client_id` por `clients.cpf_cnpj` normalizado; se falhar, fica órfão.
- Atualiza `last_omie_sync_at`. Loga erros sem abortar batch.

Cron job (pg_cron + pg_net) a cada 30 min para cada `company_id` com `is_default=true` (depois liberamos manual por CNPJ via botão "Sincronizar agora" na página de integração).

Botão "Sincronizar agora" em `/financial/integracoes/omie` por CNPJ + último sync visível.

## 4. Conexão com Vendas (deals won)

Já existe atribuição via contrato. Para deals "won" que ainda não têm contrato:
- Botão "Gerar contrato + parcelas" na ficha do deal (já existe parcialmente). Sem schema novo — apenas garantir `deal_id` no entry.
- Hook `useDealFinancialStatus(dealId)` para mostrar status no Pipeline ("3 parcelas em atraso").

## 5. Páginas que ganham dados automaticamente

Sem mudança de UI (já leem de `financial_entries`):
- Fluxo de Caixa, Lançamentos, Parcelas, Recorrentes, Aging, DRE, DRF, Comissões (via `seller_id`), Centros de Custo, Conciliação.

Adicionar pequenos filtros já existentes:
- `company_id` aplicado globalmente via `FinancialCompanyContext` (já temos o seletor — passar para as queries).
- Selo "Origem" (Manual / Contrato / Omie / Deal) na tabela de Lançamentos.

## 6. Operações ganha sinalização (preparação Fase 3)

View materializada `client_financial_status` (overdue_amount, overdue_count, oldest_overdue_days) lida em Operações por badge vermelho. Será só plugada na Fase 3, mas já é populada agora porque os entries existem.

## Ordem de execução

1. Migration (colunas + índices + trigger de geração de parcelas a partir de contratos + backfill).
2. Edge function `omie-sync-entries` + cron + botão manual.
3. `FinancialCompanyContext` aplicado nas queries das páginas (filtro por `company_id`).
4. Coluna "Origem" na página de Lançamentos.

Depois (Fase 3): badge inadimplente em Operações/RoyZapp e controle de cheques.

## Riscos / pontos de atenção

- Backfill de contratos pode criar muitos entries de uma vez — vou rodar em chunks com `installments_detail` quando existir.
- Match por CPF/CNPJ depende de `clients.cpf_cnpj` preenchido; órfãos viram lista "Sem cliente".
- Anti‑flood Omie: 500 ms entre chamadas e `LIMIT` por página = 50.
- `installments_*` columns têm triggers de imutabilidade — ao gerar via trigger uso bypass server‑side (security definer).

Pronto para executar a migration + edge function + cron na sequência.
