## O que muda

Hoje, quando um deal é marcado como "ganho", um contrato é criado — mas as parcelas no financeiro só são geradas quando alguém abre o contrato, preenche parcelas/data e clica em "Gerar Parcelas". A ideia é fazer esse passo acontecer sozinho, usando os dados que o comercial já preencheu no pipeline.

## Regras de negócio

Quando o deal vira "ganho" e gera contrato, calcular automaticamente:

- **Valor total das parcelas** = `deals.value − deals.received_value` (ex.: 240k − 20k = 220k)
- **Nº de parcelas** = campo customizado "Parcelas" do deal (ex.: 11)
- **Valor por parcela** = total ÷ parcelas (ex.: 20k)
- **Forma de pagamento** = campo customizado "Forma de Pagamento" do deal
- **1º vencimento** = data de recebimento da entrada + 30 dias
  - Se `received_value > 0`: usa `won_at` como referência da entrada
  - Se `received_value = 0`: usa `won_at` mesmo (comercial ajusta manualmente depois)
- **Ajuste manual continua disponível**: a aba "Negociação" do contrato segue permitindo editar tudo antes de gerar, e o botão "Gerar Parcelas" continua existindo pra quem precisar refazer.

## Onde tocar

1. **`src/utils/dealToClientContractMapping.ts`**  
   - Expandir `DealFieldValues` e `ContractDataFromDeal` para incluir `parcelas` (número) e `payment_method`.
   - Ler o campo `PARCELAS` em `fetchDealCustomFieldValues` (parsear label "11x" → 11).

2. **Fluxo de criação de contrato quando deal é ganho** (procurar onde `client_contracts` é criado após won — provavelmente em `SalesPipeline.tsx` ou hook relacionado):
   - Ao criar o `client_contracts`, já gravar:
     - `installments_count` = parcelas do deal
     - `first_due_date` = `won_at + 30 dias`
     - `payment_method` = forma do deal
     - `installments_detail` = array uniforme de N parcelas (valor por parcela, `due_date` = 1º venc + i meses, `method` = forma)
   - Em seguida, flipar `receivables_generated = true` + `receivables_generated_at` para o trigger `contract_generate_receivables` disparar e criar tudo em `financial_entries` + `installments`.

3. **Segurança**: só auto-gerar se:
   - `deals.value > deals.received_value` (tem saldo a parcelar)
   - Campo "Parcelas" preenchido e > 0
   - Se qualquer condição falhar, cai no fluxo antigo (contrato criado sem parcelas, usuário preenche na aba Negociação).

## Fora de escopo

- Não mexer no `PaymentBreakdownComposer` (mix Pix+Cheques etc.) — se o comercial escolheu forma composta, ele continua ajustando manualmente na aba Negociação; a auto-geração só roda para formas simples.
- Não alterar entradas já existentes: se o contrato já tinha `receivables_generated = true`, não refaz nada.

## Verificação

- Fechar um deal de teste no pipeline com valor 240k, entrada 20k, 11 parcelas, Forma "Pix"
- Confirmar que aparecem 11 parcelas de 20k no financeiro, 1ª vencendo 30 dias após o `won_at`
- Fechar outro sem preencher "Parcelas": contrato criado, aba Negociação continua pedindo preenchimento manual
