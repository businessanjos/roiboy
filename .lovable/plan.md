## Integração Open Finance (banco.mcp.ai) — Saldos + Extrato CNPJ

Vamos sincronizar **saldo** e **todas as movimentações** das contas do CNPJ Eternum, transformando cada transação em um `financial_entry` automaticamente.

### Pré-requisitos (você faz)

1. Criar conta em `https://banco.mcp.ai`
2. Conectar as contas do CNPJ Eternum via Open Finance (consentimento por banco)
3. Gerar o **MCP token / API key** no painel
4. Me passar o token quando eu pedir (vou usar o `add_secret` para guardar como `BANCO_MCP_TOKEN`)

### O que vou construir

**1. Schema (migration)**
- Adicionar em `bank_accounts`:
  - `openfinance_connection_id` (text) — ID da conexão no banco.mcp.ai
  - `openfinance_account_id` (text) — ID da conta específica
  - `last_balance_sync_at`, `last_transactions_sync_at` (timestamptz)
- Nova tabela `openfinance_sync_log` para auditoria (account_id, started_at, finished_at, transactions_imported, status, error)
- Em `financial_entries` adicionar `openfinance_transaction_id` (text, unique por account) para deduplicação

**2. Edge functions**
- `openfinance-list-accounts` — chama `openfinance_list_connections` + lista contas disponíveis para o usuário linkar manualmente em cada `bank_account`
- `sync-openfinance-balances` — atualiza `current_balance` de todas as contas linkadas (rápido, ~5s)
- `sync-openfinance-transactions` — busca transações desde `last_transactions_sync_at` (ou últimos 90 dias na 1ª vez), cria `financial_entries` com `status='paid'`, `paid_at` = data da transação, sinal correto (crédito = receita, débito = despesa), categorização básica por descrição

**3. UI em `/financial/bank-accounts`**
- Botão **"Conectar Open Finance"** por conta → abre dialog que lista contas do banco.mcp.ai e linka
- Badge "Open Finance ativo" + `last_synced_at` na linha
- Botão **"Sincronizar agora"** (saldos + transações)
- Nova aba/página **"Movimentações"** por conta exibindo o extrato (já vem de graça pois vira `financial_entries`)

**4. Cron diário**
- `pg_cron` rodando `sync-openfinance-balances` a cada 1h e `sync-openfinance-transactions` 2x/dia (manhã e noite)

### Pontos de atenção

- Transações importadas ficam **marcadas como Open Finance** (não-editáveis no valor/data) para preservar a fonte da verdade
- Conciliação automática: se já existe um `financial_entry` `pending` com mesmo valor/data próxima, sugiro merge ao invés de duplicar
- Categorização: deixo manual no início (campo `category` vazio); depois podemos usar IA pra sugerir

### Ordem de execução

1. Migration do schema
2. Pedir o `BANCO_MCP_TOKEN`
3. Edge functions + UI de linkagem
4. Sync de saldos (testar)
5. Sync de transações + página de extrato
6. Cron

Posso começar pela migration agora?