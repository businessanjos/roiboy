# 💰 ROY Financeiro — Roadmap & Blueprint

> Documento-fonte para substituir a Omie no ROY, integrando Comercial → Operações/CS → Financeiro → Contabilidade.
> Baseado na reunião de 24/04/2026 com Renata (Financeiro Eternum), Arthur Mudri e Maikol.
>
> **Status atual:** Aguardando liberação do Maikol. Comercial e Operações/RoyZapp têm prioridade. Financeiro entra na fila depois.

---

## 🎯 Princípios não-negociáveis

1. **Imutabilidade do lançamento-mãe.** Uma parcela/lançamento criado **nunca** pode ser deletado. Só pode mudar de estado: `perda`, `desconto`, `renegociação`. A origem sempre fica visível.
2. **Cliente (operação) ≠ Pagador (financeiro).** Quem recebe o serviço pode ser diferente de quem paga e de quem recebe a NF.
3. **Multi-empresa por CNPJ.** Cada CNPJ (Eternum Club, Anjos, futura SaaS Barueri) tem seu próprio financeiro, plano de contas e emissor de nota.
4. **Histórico de cobrança vive no ROY**, não em planilha. Acessível para Comercial / Operações / Bruna / Financeiro com permissões.
5. **Régua de cobrança respeita o método de pagamento.** Cartão pago = silêncio. Cheque entregue = silêncio até depositar. Etc.
6. **Integração com Receita Federal** já existe — usar para autocompletar Pagador via CPF/CNPJ.
7. **NF híbrida** (70% serviço + 30% produto), configurável por produto, gatilhada pelo recebimento, confirmada manualmente antes de emitir.

---

## 🧱 Modelo de dados proposto

### Decisão: tabela `payers` separada (não estender `clients`)

```
payers
├── id (uuid)
├── account_id (multi-tenant)
├── company_id (FK → companies)        ← multi-CNPJ emissor
├── document_type (cpf | cnpj)
├── document (único por account)
├── legal_name (razão social ou nome civil — vem da Receita)
├── trade_name (nome fantasia, opcional)
├── email_billing
├── phone_billing
├── address_* (CEP, logradouro, número, comp, bairro, cidade, UF)
├── ie / im (inscrição estadual/municipal, opcional)
├── notes
├── created_at / updated_at / created_by

client_payers                              ← N:N entre Client e Payer
├── client_id
├── payer_id
├── relationship (self | spouse | company | parent | other)
├── is_default (bool)
└── unique (client_id, payer_id)
```

**Casos cobertos:**
- Cliente Ana usa serviço, paga no CPF do Renato → 1 client + 1 payer (relationship `spouse`).
- Marido + esposa em cadeira dupla, ambos pagos pelo CNPJ da clínica → 2 clients + 1 payer (relationship `company`).
- Renovação trocou o titular fiscal → novo payer (não sobrescrever o antigo).

### Faturas e parcelas

```
invoices                                  ← venda/contrato lançado no financeiro
├── id, account_id, company_id
├── deal_id (FK opcional)                 ← origem comercial
├── contract_id (FK opcional)
├── client_id                             ← quem usa
├── payer_id                              ← quem paga / leva NF
├── product_id
├── description
├── total_amount
├── currency (default BRL)
├── service_pct (default produto)         ← split NF (default vem do produto)
├── product_pct
├── status (draft | active | renegotiated | settled | written_off | judicial)
├── opened_at / closed_at
├── parent_invoice_id                     ← rastreio de renegociação (origem-mãe)
└── created_by, updated_at, locked_at

installments
├── id, invoice_id, account_id
├── number (1..N)
├── due_date
├── amount
├── payment_method (cash | pix | boleto | credit_card | check | transfer | platform)
├── status (pending | scheduled | paid | overdue | renegotiated | written_off | judicial | refunded)
├── check_status (null | requested | in_transit | received | deposited | cleared | bounced | renegotiated)
├── card_status (null | charged | failed | refunded)
├── paid_at, paid_amount, fees, discount
├── notes
└── locked (bool — true após primeiro recebimento)

installment_events                        ← histórico imutável (substitui planilha)
├── id, installment_id, account_id
├── event_type (note | charge_attempt | message_sent | promise | renegotiation | dispute | judicial | bounce | partial_payment | full_payment | discount | write_off)
├── payload (jsonb)
├── visible_to (sales | ops | finance | all)
├── created_by, created_at
```

**Regra:** UPDATE/DELETE em `installments` e `invoices` é restrito por trigger/RLS após `locked=true`. Mudanças geram `installment_events` ao invés de mutação.

### Contas a pagar

```
suppliers                  (cadastro fornecedor — CNPJ via Receita)
bills                      (contas a pagar; vincula a supplier + chart_account)
chart_accounts             (plano de contas hierárquico, alinhado contabilidade)
payments                   (efetivação — cash, transfer, etc.)
advance_accounts           (adiantamento cliente / fornecedor — conciliação contábil)
```

### Régua de cobrança

```
billing_rules
├── id, account_id, company_id
├── name, is_active
├── trigger (days_before_due | days_after_due | on_bounce | on_promise_break)
├── days_offset
├── applies_to_methods (text[])           ← ex: {pix, boleto, check_bounced} — exclui cartão pago
├── channel (whatsapp | email | sms)
├── template_id (FK roy_zapp_templates)
└── stop_conditions (jsonb)

billing_rule_runs (log de cada disparo p/ auditoria)
```

### Multi-CNPJ

```
companies
├── id, account_id
├── legal_name, document (CNPJ)
├── trade_name
├── address_*
├── tax_regime (simples | lucro_presumido | lucro_real | sas_barueri)
├── default_service_pct / default_product_pct
├── notazz_token (secret)
├── is_default
```

Selector no header global (dropdown ao lado do avatar) filtra todo o financeiro por `company_id` ativo.

---

## 🔌 Integrações

| Sistema | Hoje | Plano |
|---|---|---|
| Omie | Fonte da verdade financeira | Importação completa no dia zero (inclusive inadimplentes/judicial), depois congelar |
| Notazz | Emissor de NF híbrida via Omie | Integração direta ROY → Notazz por `company_id` |
| Receita Federal | Já integrado no ROY | Reusar para preencher `payers` |
| RoyZapp | Mensageria | Canal padrão da régua de cobrança |
| Asaas | Não usado, sugerido | Avaliar para boletos/PIX novos (gradual, mantendo Omie nos antigos) |
| Stripe | Vendas internacionais / Anjos | Webhook → cria invoice + payer com payer_id mapeado por CPF |

---

## 🔄 Fluxo end-to-end (felicidade)

1. **Comercial** marca deal como Ganha → wizard pede dados de Pagador (autocompleta via Receita se CPF/CNPJ).
2. ROY cria `invoice` + `installments` + vínculo `client ↔ payer`.
3. Cliente paga 1ª parcela → trigger atualiza `installment.status=paid` → cria pendência de NF (split 70/30 do produto).
4. Renata confere → confirma → ROY chama Notazz por `company_id`.
5. NF emitida → `installment_events` registra; visível para Comercial (libera comissão se regra exigir cheques).
6. Próximas parcelas seguem a régua conforme `payment_method`.
7. Inadimplência: Renata abre parcela → registra `event_type=promise|renegotiation` → status muda → planilha morre.
8. Renegociação: nova `invoice` com `parent_invoice_id` → original fica `renegotiated`, **não some**.

---

## 🚧 Etapas de entrega (quando Maikol liberar)

### Fase 1 — Fundação (sem UI, sem quebra)
- [ ] Migrations: `companies`, `payers`, `client_payers`, `chart_accounts`
- [ ] Selector de `company_id` no header (placeholder, filtra nada ainda)
- [ ] Wizard Ganha pedindo Pagador (com Receita autocompletar)

### Fase 2 — Contas a Receber
- [ ] `invoices`, `installments`, `installment_events` + RLS imutável
- [ ] Tela "Contas a Receber" (substitui planilha): lista de parcelas com status granular, modal com timeline de events
- [ ] Régua de cobrança configurável + integração RoyZapp
- [ ] Dashboard Inadimplência (real-time, sem editar relatório)

### Fase 3 — NF e Notazz
- [ ] Integração Notazz por company
- [ ] Split serviço/produto por produto
- [ ] Fila de NF a emitir (confirma manual)

### Fase 4 — Contas a Pagar + Plano de contas
- [ ] `suppliers`, `bills`, `chart_accounts`, `advance_accounts`
- [ ] Importador de contratos de plataforma (SaaS sem nota)
- [ ] DRE simplificada alinhada contabilidade

### Fase 5 — Migração Omie
- [ ] Importador completo (CSV/API) com modo **dry-run**
- [ ] Período de operação dupla (ROY + Omie) para validação
- [ ] Dia zero → congela Omie

### Fase 6 — Multi-empresa real
- [ ] Notazz por CNPJ
- [ ] Eventual SaaS Barueri (regime fiscal startup, ISS 2%)
- [ ] Stripe → invoice na company correta (Anjos para Ever IA hoje)

---

## 📋 Demandas do time financeiro (15/05/2026 — Renata)

### Contas a Receber
- [ ] **Importador Cielo** — upload de relatório (CSV/Excel) → conciliação automática das parcelas de cartão (match por valor/data/NSU/bandeira) → baixa em massa
- [ ] **Taxa de cartão nos lançamentos** — campo `card_fee` por parcela; valor líquido recebido vs bruto vendido; alimenta DRE
- [ ] **Importador de cheques** — upload do relatório bancário (compensação) → baixa automática por número/valor
- [ ] **Automação de baixa** — cartão (Cielo), cheque (banco), boleto (retorno CNAB/PIX webhook) → status atualizado sem ação manual
- [ ] **Status granular do pagamento** — enum por método: cheque (`requested | in_transit | received | deposited | cleared | bounced`), cartão (`charged | settled | refunded | chargeback`), boleto (`registered | paid | overdue`). Já previsto no schema (`installments.check_status` / `card_status`); precisa expor na UI com filtros.

### Governança e imutabilidade
- [ ] **Botão Renegociar** — gera novo borderô (`invoices.parent_invoice_id`), original fica `renegotiated`, **nada é deletado**. Auditoria completa de quem renegociou e por quê
- [ ] **Trava de exclusão global** — nenhuma operação `DELETE` no financeiro. Só transições de estado: `baixa`, `renegociação`, `perda`, `desconto`. RLS + trigger bloqueando delete pós-`locked=true`
- [ ] **CRM/Pipeline de cobrança** — Kanban dedicado ("Inadimplência leve / em negociação / promessa de pagamento / quebrada / jurídico") com atendente humano responsável, SLAs e histórico via `installment_events`

### Faturamento fiscal
- [ ] **Trava pós-NF** — após emitir nota, parcela trava número da NF e bloqueia edição (campo `invoice_number`, `invoiced_at`). Edição só por estorno explícito + nova NF
- [ ] **Régua personalizada por método** — cartão pago = silêncio total; cheque = silêncio até data de depósito; boleto/PIX = régua agressiva. Configurável por `billing_rules.applies_to_methods`

### Plano de contas e categorização
- [ ] **Plano de contas hierárquico** (`chart_accounts`) — receitas, despesas operacionais, impostos, fornecedores. Categorização obrigatória em todo lançamento. Alinhado com contabilidade externa
- [ ] **Status automatizado em campos customizados e histórico** — `installment_events` alimenta timeline visível em Comercial, Operações e Financeiro

### Ciclo do contrato
- [ ] **Quitação automática** — ao baixar a última parcela do contrato, status do contrato vai para `quitado` automaticamente. Sinal visível para Operações/CS no contexto de **renovação** (cliente quitado = pronto pra renovar sem fricção)

---

## ⚠️ Pontos de atenção

- **Não criar nada do financeiro enquanto o RoyZapp Operações estiver instável** (palavra do Maikol).
- **Cuidar de regressão**: sistema atual mistura camadas; financeiro precisa nascer isolado por feature flag.
- **Comissionamento depende disso**: Maikol já sinalizou para Jonathan que comissão de comercial só sai com cheque entregue → régua precisa expor `check_status` para o módulo de comissão.
- **Omie auto-cria coisas que perdem dados** (delete acidental). Imutabilidade é resposta direta a essa dor.
- **Plataformas SaaS sem nota** = dor crônica. `advance_accounts` + alerta de "nota fiscal pendente há X dias" mata isso.
