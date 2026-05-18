## Nova área: Tributário & Contador

Criar uma seção dedicada dentro de Financeiro para centralizar tudo que hoje não tem casa: regime tributário, contador, recomendações de IA fiscal e alertas estruturais (classificação de produtos, pró-labore/distribuição de lucros, etc.).

### Rota e navegação

- Nova rota: `/financial/tributario`
- Entrada no sidebar do Financeiro, abaixo de "Conciliação" e antes de "DRE/DRF"
- Ícone: `Scale` (lucide) — neutro, evita conotação só de "imposto"

### Layout (4 abas dentro da página)

```text
[ Visão geral ] [ Regime & Empresa ] [ Contador ] [ Alertas & IA ]
```

**1. Visão geral**
- KPIs (FinancialKpiCard): Regime atual, Faturamento 12m vs teto do regime, Pró-labore do mês, Alertas abertos
- Card "Próximas obrigações" (DAS, DCTF, etc.) — manual por ora, integrável depois
- Card "Última conversa com contador"

**2. Regime & Empresa (por CNPJ — usa CompanySelector já existente)**
- Regime: Simples Nacional / Lucro Presumido / Lucro Real / MEI
- Anexo (quando Simples): I, II, III, IV, V
- CNAE principal + secundários
- Inscrição estadual / municipal
- Atividade preponderante (serviços, comércio, indústria, misto)
- Data de início, data da última opção/troca de regime
- Observações livres

**3. Contador**
- Nome, escritório, CRC, telefone, e-mail, WhatsApp
- Honorário mensal (vinculável a um lançamento recorrente já existente)
- Frequência de contato esperada (mensal/trimestral)
- Histórico de interações (timeline simples: data + nota + anexo)
- Botão "Abrir conversa no RoyZapp" se telefone bater com contato existente

**4. Alertas & IA**
- Lista de alertas gerados (status: aberto / lido / resolvido / dispensado)
  - Tipos: classificação de produto/serviço, pró-labore não retirado, distribuição de lucro acima do isento, faturamento aproximando teto do Simples, despesa pessoal em conta PJ, falta de NF emitida vs entrada bancária, mudança de anexo sugerida
- Botão "Rodar análise agora" → chama edge function com Lovable AI (gemini-2.5-pro)
  - Contexto enviado: regime, faturamento 12m, mix de receitas (products/categories), pró-labore registrado, despesas categorizadas, distribuição de lucro registrada
  - Retorno estruturado: `[{tipo, severidade, titulo, descricao, acao_sugerida}]`
- Recomendações persistidas em tabela, com "última análise em DD/MM"
- Frequência sugerida: rodar mensalmente (cron opcional numa fase futura)

### Dados (migration)

Tabelas novas (todas com `account_id` + RLS por account):

- `financial_tax_profile` — 1 por `omie_settings.id` (CNPJ): regime, anexo, cnae_principal, cnaes_secundarios[], ie, im, atividade, opcao_em, observacoes
- `financial_accountant` — 1 por `omie_settings.id`: nome, escritorio, crc, telefone, email, whatsapp, honorario_brl, frequencia, observacoes
- `financial_accountant_interactions` — N por contador: data, nota, anexo_url
- `financial_tax_alerts` — N por empresa: tipo (enum), severidade (info/warning/critical), titulo, descricao, acao_sugerida, status (open/read/resolved/dismissed), origem (manual/ai), created_at, resolved_at, resolved_by
- `financial_tax_ai_runs` — log de cada análise: input_summary jsonb, output jsonb, model, tokens, created_by

RLS: padrão do projeto — `account_id = current_account_id()`.

### IA

- Edge function `financial-tax-ai-analyze`
  - Recebe `omie_settings_id`
  - Junta tax_profile + agregados financeiros (12 meses) + retiradas de sócios + mix de produtos
  - Prompt em PT-BR pedindo análise tributária objetiva e alertas estruturados em JSON
  - Modelo: `google/gemini-2.5-pro` (raciocínio + contexto longo)
  - Persiste em `financial_tax_alerts` e `financial_tax_ai_runs`

### Componentes

- `src/pages/financial/FinancialTaxPage.tsx` (página com tabs)
- `src/components/financial/tax/TaxOverviewTab.tsx`
- `src/components/financial/tax/TaxRegimeForm.tsx`
- `src/components/financial/tax/AccountantTab.tsx`
- `src/components/financial/tax/TaxAlertsTab.tsx`
- `src/components/financial/tax/AlertCard.tsx`
- Reusa `FinancialPageHeader`, `FinancialKpiCard`, `FinancialEmptyState`, `FinancialPageSkeleton`

### O que **não** entra agora

- Integração direta com sistemas contábeis (Domínio, Alterdata, eContador) — fica para fase futura
- Geração/envio de obrigações acessórias
- Cálculo automático de DAS — só **alerta** sobre proximidade de teto, sem calcular guia
- Cron de análise — por ora botão manual; deixo gancho pronto

### Ordem de execução (1 rodada)

1. Migration (5 tabelas + RLS + enum de severidade/tipo)
2. Edge function de análise
3. Página + 4 abas + componentes
4. Item no sidebar do Financeiro
5. Atualizar memory `mem://features/financial/roy-financial-roadmap-pt` mencionando a nova área

Posso seguir?
