---
name: Pluggy Banking Integration
description: Integração Open Finance via Pluggy para sync de saldo/extrato de contas PJ Eternum; substitui banco.mcp.ai
type: feature
---

# Pluggy — Open Finance no ROY

## Decisão estratégica
Pluggy é o integrador oficial para leitura de saldo e extrato bancário no ROY (substitui banco.mcp.ai por cobertura PJ, widget pronto e maturidade). Edge functions antigas `sync-openfinance-*` e `openfinance-list-accounts` ficam como legado e não devem ser usadas em novos fluxos.

## Secrets
- `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` (Edge Functions)
- Helper `supabase/functions/_shared/pluggy.ts` faz cache em memória do API Key (~2h) e expõe `pluggyFetch(path, init)`.

## Edge Functions
- `pluggy-create-connect-token` — gera token efêmero p/ widget; aceita `itemId` para update flow
- `pluggy-list-item-accounts` — após widget retornar itemId, lista contas para o usuário escolher
- `pluggy-sync-balances` — loop em `bank_accounts` com `openfinance_provider='pluggy'`; atualiza `current_balance` e `last_balance_sync_at`
- `pluggy-sync-transactions` — paginado (200/página, max 50 páginas), incremental desde `last_transactions_sync_at` ou 90 dias; insere em `financial_entries` com `source='openfinance'`, `is_conciliated=true`, dedup por `openfinance_transaction_id`

## Schema
- `bank_accounts.openfinance_provider` ('pluggy' | 'banco_mcp') — discriminador
- Reaproveita `openfinance_connection_id` (= Pluggy itemId), `openfinance_account_id` (= Pluggy accountId), `openfinance_institution` (nome do banco)
- `openfinance_sync_logs.provider` rastreia origem do sync

## UI
- `PluggyConnectDialog` carrega widget de `https://cdn.pluggy.ai/web-connect/v2.10.0/pluggy-connect.js`, abre seletor de banco, recebe `itemId` em `onSuccess`, lista contas via edge function, usuário escolhe e vincula
- Trigger: dropdown "Conectar via Pluggy" em `/financial/bank-accounts`
- Botão "Sincronizar" no extrato (`/financial/bank-accounts/:id/extrato`) chama `pluggy-sync-balances` + `pluggy-sync-transactions` em paralelo

## Migração legada
Contas já vinculadas via banco.mcp.ai ficam marcadas como `openfinance_provider='banco_mcp'` e param de sincronizar (precisam ser desvinculadas e reconectadas via Pluggy).
