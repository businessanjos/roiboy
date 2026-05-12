
# Roadmap Omie → Financeiro → Operações

Tudo isso vai ser entregue em **4 fases incrementais**. Cada fase entrega valor sozinha e a próxima depende da anterior. Nada quebra o que já existe hoje.

---

## Fase 1 — Multi-CNPJ (base de tudo)

**Objetivo:** suportar várias empresas Omie na mesma conta, com seletor de CNPJ no topo do financeiro.

**Mudanças:**
- Tabela `omie_integrations` ganha colunas: `cnpj`, `company_name`, `is_default` (já existe 1 linha por conta hoje — vira 1 linha por CNPJ).
- Tabela nova `financial_companies` (id, account_id, cnpj, legal_name, trade_name, omie_integration_id, color).
- Página **`/financial/integracoes/omie`**: lista de CNPJs com botões "Adicionar CNPJ", "Testar conexão", "Definir como padrão".
- Componente `<CompanySelector>` no header de todas as páginas `/financial/*` (lembra escolha em localStorage).
- `omie-dashboard-metrics` passa a aceitar `company_id` e usar a integração correta.

**O que muda pro usuário:** dashboard mostra "Eternum Mentoring Club Ltda" no topo, com dropdown pra trocar de CNPJ. Cada CNPJ mostra seus próprios números.

---

## Fase 2 — Sync Omie → `financial_entries`

**Objetivo:** importar todos os títulos do Omie pra nossa base, pra que **todas** as páginas do financeiro (Cash Flow, Installments, Recurring, Cost Centers, Profitability) reflitam Omie automaticamente.

**Mudanças:**
- `financial_entries` ganha colunas: `company_id` (FK pro CNPJ), `omie_id` (id do título no Omie), `omie_payload` (jsonb), `last_omie_sync_at`. Índice único em `(account_id, omie_id)` pra idempotência.
- Edge function nova `omie-sync-entries`: busca contas a receber + a pagar dos últimos 12 meses + próximos 12 meses, faz upsert em `financial_entries`. Roda em chunks pra evitar rate limit do Omie ("consumo redundante").
- Cron job a cada 30 min (pg_cron + pg_net).
- Botão "Sincronizar agora" na página `/financial/integracoes/omie`.
- Tentativa de match cliente: por CPF/CNPJ → `clients.cpf_cnpj`. Quando não bater, fica órfão (`client_id = null`) e aparece numa lista "Lançamentos sem cliente".
- `useFinancialDashboardMetrics` agora cobre Omie nativamente — o card "Dados Omie" separado pode ser removido depois (vira a fonte canônica).

**O que muda pro usuário:** Cash Flow, Installments, Profitability etc. passam a refletir o Omie de verdade. Filtros de CNPJ e de produto (via `client_contracts.product_id`) passam a funcionar em todas elas.

---

## Fase 3 — Flag de inadimplência em Operações / RoyZapp / Sales

**Objetivo:** sinalizar visualmente clientes com títulos vencidos.

**Mudanças:**
- View materializada `client_financial_status` (refresh a cada sync): por `client_id` retorna `overdue_amount`, `overdue_count`, `oldest_overdue_days`, `next_due_date`.
- Hook novo `useClientFinancialStatusBatch(clientIds)` (batch, igual `useVipClientIds`).
- Componente `<OverdueBadge clientId>`: badge vermelho com tooltip ("R$ 4.200 em aberto, 32 dias atrasado").
- Plugar em: card de cliente em Operações, header da conversa no RoyZapp, lista de Sales (Closer/SDR), página de detalhe do cliente.
- Filtro "Apenas inadimplentes" na lista de clientes em Operações.

**O que muda pro usuário:** abre RoyZapp e na hora vê quem está devendo. Operações ganha filtro pra acionar inadimplentes em massa.

---

## Fase 4 — Controle de cheques / forma de pagamento por contrato

**Objetivo:** rastrear quem prometeu cheque e ainda não enviou.

**Mudanças:**
- Tabela nova `contract_payment_tracking`: `contract_id`, `installment_number`, `method` (cheque/PIX/cartão/boleto), `status` (pending_send / received / cleared / bounced), `due_date`, `received_at`, `notes`, `attachment_url`.
- Aba nova "Pagamentos" no detalhe do contrato (conta com `clients.payment_method` que já existe).
- Tela `/operations/cheques-pendentes`: lista todos os cheques com `status = pending_send`, ordenado por urgência. Ações em massa: marcar como recebido, abrir conversa no RoyZapp.
- Quando o sync da Fase 2 detectar pagamento Omie equivalente, sugere automaticamente "marcar como cleared".

**O que muda pro usuário:** Operações tem uma fila clara de "quem precisa cobrar cheque hoje".

---

## Observações importantes

- **Match Cliente ↔ Omie**: depende de `clients.cpf_cnpj` estar preenchido. Vou adicionar um aviso na página de integração mostrando quantos clientes ainda estão sem CPF/CNPJ pra reduzir órfãos.
- **Anti-flood Omie**: o erro "consumo redundante" que já apareceu volta se sincronizarmos demais. O sync vai usar paginação + `await sleep(500ms)` entre chunks + janela de tempo limitada.
- **Filtro por produto**: como Omie não tem produto, a quebra por produto sempre passa por `client_id → client_contracts.product_id`. Lançamento sem cliente = não aparece nos cortes por produto (fica em "Sem alocação").
- **Compatibilidade**: durante a Fase 2, mantenho o card "Dados Omie" atual funcionando até o sync estar 100% confiável. Só depois removo.

---

## Sequência de entrega proposta

Vou começar pela **Fase 1** (multi-CNPJ + página de integração refeita). Quando aprovar e validar, sigo pra Fase 2 no mesmo prompt seguinte. Faz sentido?
