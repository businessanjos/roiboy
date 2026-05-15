## Roadmap Financeiro ROY — Implementação Completa

Escopo grande (15 demandas). Vou entregar em **4 fases** sequenciais para não travar o sistema atual e permitir validação do time financeiro a cada etapa.

---

### FASE 1 — Fundação & Governança (rápido, alto impacto)
1. **Status granular de pagamento** por método em `installments`:
   - Enum novo `payment_status`: `cheque_enviado`, `cheque_pendente`, `cheque_recebido`, `cheque_devolvido`, `boleto_emitido`, `boleto_registrado`, `cartao_autorizado`, `cartao_capturado`, `cartao_estornado`, `pix_aguardando`, `pix_confirmado`, `transferencia_pendente`, `transferencia_confirmada`
   - Campo `payment_status` separado do `status` lógico (paid/overdue/etc)
   - Histórico automático em `installment_events` a cada mudança
2. **Trava global de exclusão**: triggers em `contracts`, `invoices`, `installments` bloqueando DELETE (apenas soft-update via renegociação/baixa/perda)
3. **Botão Renegociar** na timeline da parcela:
   - Marca original como `renegotiated` (mantém registro)
   - Gera novo borderô (novas parcelas) vinculado por `renegotiated_from_id`
   - Modal pede: motivo, novo plano (qtd parcelas, valor, vencimento), método

### FASE 2 — Importadores & Baixa Automática
4. **Importador Cielo** (CSV/Excel): edge function parseia relatório e auto-concilia por valor + data + bandeira + NSU; baixa em massa com preview
5. **Taxa de cartão por parcela**: campo `card_fee_amount` e `card_fee_percent` em `installments`; entra no DRE/conciliação
6. **Importador Cheque** (CSV/manual): registra cheques, vincula a parcelas, atualiza `payment_status`
7. **Baixa automatizada**:
   - Cartão: via importador Cielo
   - Boleto: webhook bancário (CNAB ou API banco) → marca paga
   - PIX: webhook → marca paga
   - Cheque: ao mudar status para `cheque_recebido` → baixa automática

### FASE 3 — Plano de Contas, Cobrança & NF
8. **Plano de Contas**: tabela `chart_accounts` hierárquica (categoria → subcategoria → conta); campo `chart_account_id` obrigatório em `installments` e `financial_entries`
9. **Régua de cobrança personalizada por método**: tabela `dunning_rules` com filtros (`payment_method`, dias antes/depois vencimento, canal: WhatsApp/email/SMS, template); cartão e cheque desligados por padrão, boleto ativo
10. **CRM/Pipeline de Cobrança**: novo Kanban em `/financial/cobranca` com colunas (A vencer 7d → Vencida → Negociando → Promessa de pagamento → Quebrou promessa → Judicial → Recuperada); cada parcela vencida vira card; agente humano move e registra interação
11. **Faturamento Fiscal com trava**: botão "Faturar NF" em invoice/parcela → após emissão grava `nf_number` + `nf_issued_at` → trava edição do valor (campo `locked_by_invoice = true`)

### FASE 4 — Ciclo Final & Sinalização
12. **Quitação automática do contrato**: trigger ao marcar última parcela como paga → `contracts.status = 'quitado'` + `quitado_at`
13. **Sinal de quitação para Operações/CS**: badge âmbar "Quitado — pronto para renovação" no `/clients` e dentro do client drawer (lê `contracts.status = 'quitado'` AND `end_date > now() - 90d`)
14. **Status automatizado em campos customizados**: ao mudar `payment_status` ou `status`, hook escreve no histórico do client e no campo customizado correspondente (mesmo padrão do briefing de operação)
15. **Métrica "Última parcela quitada"** visível no header do contrato e no card do cliente

---

### Detalhes técnicos

**Migrations (Fase 1):**
- `payment_status` enum + coluna em `installments`
- `installment_events` (já existe? se sim, adiciona evento `payment_status_changed`)
- Triggers DELETE bloqueando em `contracts`, `invoices`, `installments`
- Coluna `renegotiated_from_id` (self-FK) em `installments`

**Edge functions novas:**
- `import-cielo-report` (Fase 2)
- `import-cheques` (Fase 2)
- `bank-webhook-receiver` (Fase 2)
- `issue-fiscal-invoice` (Fase 3) — integra Notazz já mapeado no roadmap
- `dunning-engine-cron` (Fase 3) — processa régua diariamente
- `auto-quitar-contract` trigger SQL (Fase 4)

**UI nova:**
- Modal Renegociar (Fase 1)
- Página `/financial/importar` com 2 abas: Cielo / Cheques (Fase 2)
- Página `/financial/plano-de-contas` (Fase 3)
- Página `/financial/cobranca` Kanban (Fase 3)
- Página `/financial/regua-cobranca` (Fase 3)
- Botão "Faturar NF" + lock visual (Fase 3)
- Badge "Quitado" em ClientCard, ContractList (Fase 4)

**Memória de projeto:** atualizar `mem://features/financial/roy-financial-roadmap-pt` ao final de cada fase com o que foi entregue.

---

### Confirmações antes de começar

1. **Fase 1 agora?** (1-2 dias de build, migrations + 1 modal + triggers — baixo risco)
2. **Régua de cobrança WhatsApp** vai usar RoyZapp (já temos compliance/limits) — ok?
3. **Webhook bancário** — qual banco? (Itaú, Bradesco, Santander, Inter têm APIs diferentes; CNAB 240 funciona para todos mas é arquivo, não realtime)
4. **NF Fiscal** — Notazz já está no roadmap. Confirmar que é Notazz mesmo?

Posso começar pela **Fase 1** assim que você confirmar.
