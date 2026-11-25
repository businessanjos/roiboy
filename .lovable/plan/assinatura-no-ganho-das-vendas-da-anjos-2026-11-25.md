# Assinatura no ganho das vendas da Anjos

## O que muda para o vendedor

1. **Primeira pergunta do ganho** — ao marcar como ganha uma venda da empresa Anjos (Clínica Ryka e qualquer outro produto dela), a janela de campos obrigatórios abre com "É uma assinatura?" (Sim / Não) no topo. Sem responder, o botão de ganhar fica bloqueado.
2. **Se "Sim"** — aparece "É uma assinatura mensal ou anual?", também obrigatória. A forma de pagamento passa a oferecer só:
   - Anual: Pix ou Cartão de crédito (sem a opção combinada "Pix + Cartão").
   - Mensal: Cartão recorrência.
3. **Se "Não"** — o ganho segue exatamente como é hoje, com todas as formas de pagamento.
4. **Preenchimento automático** — se o negócio já tiver uma forma de pagamento compatível com a escolha, ela já vem selecionada. Se tiver outra (cheques, boleto, combinações etc.), o campo aparece vazio para o vendedor escolher entre as permitidas, e essa escolha passa a ser a forma de pagamento do negócio.
5. **No card** — logo abaixo de "É uma renovação", um bloco somente leitura mostra "Assinatura: Sim · Mensal", "Sim · Anual" ou "Não". Só aparece depois de respondido.

Vendas da Eternum não recebem a pergunta e continuam iguais.

## Onde a pergunta aparece

Hoje o ganho pode ser dado por vários lugares. Para a regra não ter atalho, a mesma pergunta vale em todos:
- Pipeline (card e quadro).
- Negócio aberto dentro do RoyZapp.
- Atalhos de ganho em Leads, Tarefas e na ficha do cliente — hoje ganham direto; para vendas da Anjos passam a abrir a mesma janela antes.

## O que não muda

- Briefing, valor recebido, dados de faturamento, contrato, parcelas, comissões e SPIFFs.
- Permissões e visibilidade dos negócios.
- Negócios já ganhos: ficam sem a informação (o card não mostra o bloco). Se um for reaberto e ganho de novo, a pergunta aparece.
- Nada será publicado sem a sua autorização.

## Detalhes técnicos

- **Banco (migração aditiva)**
  - `deals.is_subscription boolean null` e `deals.subscription_cycle text null` com CHECK (`monthly`/`annual`, e ciclo só quando `is_subscription = true`). Sem novas políticas: usa o RLS de atualização que já protege `deals`.
  - `companies.requires_subscription_on_win boolean not null default false`, ligado na mesma migração para a empresa Anjos. A regra segue esse marcador, não o nome da empresa, então renomear a empresa ou criar outra com a mesma exigência não quebra nada.
- **Qual empresa** — usa `deals.company_id`, já mantido pelo gatilho que acompanha o Item da Venda; é relido no momento do ganho.
- **Regra única** — novo `src/lib/sales/subscriptionWin.ts` (puro): formas permitidas por ciclo (`pix`, `cartao_credito` / `cartao_recorrencia`), compatibilidade do valor atual e validação de completude. Um auxiliar lê negócio + empresa e diz se a pergunta é exigida; todos os pontos de ganho o consultam.
- **Janela** — `RequiredFieldsModal` ganha o bloco de assinatura no topo da aba "Dados da Negociação", filtra as opções de "Forma da Pagamento" (exibindo o campo mesmo quando já preenchido, se for assinatura), reaproveita o detalhamento de pagamento existente e salva as duas colunas junto com os demais campos. Quando a forma muda, o "Detalhamento de Pagamento" é regravado para não ficar com dados da forma anterior.
- **Pontos de ganho** — `SalesPipeline.handleMarkAsWon`, `ZappDealDetailSheet`, e os atalhos de `Leads`, `LeadsTab`, `Tasks` e `ClientDeals` abrem a janela quando a resposta é exigida e ainda não existe.
- **Card** — bloco somente leitura em `DealDetailSheet` abaixo de "É uma renovação"; `useDeals` passa a trazer as duas colunas.
- **Testes** — um por regra em `subscriptionWin.test.ts`: anual só Pix/Cartão de crédito; mensal só Cartão recorrência; forma compatível é puxada; forma incompatível não é puxada; empresa sem o marcador não exige a pergunta; "Sim" sem ciclo bloqueia. Teste de banco para o CHECK.
- **Registro** — regra anotada no `AGENTS.md` de vendas e as escolhas (formas por ciclo, vale para Anjos) na memória do projeto.
