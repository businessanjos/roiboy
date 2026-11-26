# Vendas sem dono do RykaPay: solicitação, vínculo pelo gestor e pagador guardado na ficha

Vale somente para o Programa Clínica Ryka, onde a trava de pagamento já existe. A regra "sem pagamento confirmado, ninguém libera" continua: o gestor não libera o ganho no escuro, ele aponta qual venda paga pertence ao negócio.

## O que foi conferido no RykaPay (somente leitura)

- A consulta por e-mail do Saulo já devolve o bloco da Stripe com assinaturas e cobranças.
- O ROY hoje ignora esse bloco: mesmo com a Stripe chegando, o ganho continua travado. Isso entra no plano.
- A lista geral de cobranças traz nome do pagador, valor, data, forma e situação (57 cobranças, 26 pagas, todas Pix, boleto ou link). Não traz CPF, e-mail nem vendas da Stripe.
- O ROY não guarda hoje qual venda do RykaPay pertence a qual negócio. Sem isso não há como saber o que está sem dono.

## Como vai funcionar

1. **Ganho normal (pagador é o próprio cliente)**
   - Nada muda para o vendedor. Ao confirmar o pagamento, o ROY passa a registrar "esta venda é deste negócio".
   - Pagamentos da Stripe encontrados pelo e-mail passam a liberar o ganho, como os do RykaPay.

2. **Pagamento não encontrado**
   - No aviso âmbar aparece o botão **Solicitar ao gestor**.
   - Abre a lista de vendas pagas ainda sem dono (nome de quem pagou, valor, data, forma). O vendedor pode marcar a que acredita ser a dele e escrever uma observação.
   - Se a venda não estiver na lista (caso da Stripe), o vendedor informa o e-mail ou CPF/CNPJ de quem pagou.
   - O ganho segue bloqueado, com o aviso "Aguardando o gestor".

3. **Gestor recebe e vincula**
   - Chega a notificação no sininho (e no celular, pelo aviso que já existe), com link direto.
   - Ele vê o negócio, a sugestão do vendedor e as vendas sem dono, escolhe a venda certa e informa a relação: **Sócio, Marido/Esposa, Cartão da empresa ou Outro (escreve)**.
   - Pode recusar com motivo; o vendedor é avisado nos dois casos.
   - Ao vincular, o ROY confere de novo no RykaPay se a venda está paga. Só então grava.

4. **Vendedor dá o ganho**
   - Ao clicar em "Verificar de novo", o card verde aparece com "Pago por Fulana (Esposa)" e o ganho é liberado com as demais validações de sempre.

5. **Pagador fica na ficha**
   - O pagador e a relação ficam guardados no lead e passam para o cliente no ganho, visíveis na aba Assinaturas.
   - Nas próximas vendas, o ROY já consulta também os dados desse pagador. Se achar pagamento por ele, mostra "Pago por Fulana (Esposa). Foi ela que pagou?" e o vendedor confirma antes de seguir, sem precisar do gestor de novo.

## O que conta como venda sem dono

- Venda paga no RykaPay, criada a partir da data em que isso entrar no ar, e que não foi registrada em nenhum negócio nem vinculada pelo gestor.
- Vendas antigas não entram, para a lista não nascer com as 26 vendas já pagas.
- A lista é montada na hora em que alguém abre (até as 200 cobranças mais recentes), sem rotina em segundo plano, já que os casos são raros.

## Limites atuais da API do RykaPay

- **Stripe não aparece na lista**: a API só mostra a Stripe quando se consulta um e-mail. Por isso, nesses casos, o caminho é informar o e-mail de quem pagou. Para aparecerem na lista, o RykaPay precisa oferecer uma listagem das vendas da Stripe.
- **Lista só com nome**: sem CPF/e-mail na listagem, o gestor identifica pelo nome, valor e data. O documento do pagador é opcional no vínculo; quando informado, as próximas vendas são reconhecidas sozinhas.
- **Assinatura mensal no cartão pelo checkout do RykaPay**: ainda preciso confirmar se aparece na lista geral; é o primeiro passo da construção. Se não aparecer, segue o mesmo caminho do e-mail/CPF.

## Quem pode vincular

Administradores e gestores comerciais. Vendedor só solicita e só vê as próprias solicitações.

## Detalhes técnicos

- Novas tabelas, com RLS por conta e GRANTs:
  - `pay_sale_links`: venda (id externo, origem rykapay/stripe, valor, data, nome do pagador) ligada a `deal_id`; única por conta + venda; marca se foi automática ou pelo gestor.
  - `pay_link_requests`: negócio, solicitante, venda sugerida, e-mail/documento informado, observação, situação (pendente/aprovada/recusada), quem decidiu, motivo.
  - `pay_third_party_payers`: lead e/ou cliente, nome, documento e e-mail opcionais, relação (`partner`, `spouse`, `company_card`, `other` + texto), quem aprovou. Trigger no ganho copia do lead para o cliente.
- Decisões por RPC `SECURITY DEFINER` com checagem de papel (`request_pay_link`, `decide_pay_link`), que também inserem em `notifications` (o push existente dispara pelo trigger atual).
- Funções de backend:
  - `rykapay-read`: ler o bloco `stripe` (cobranças pagas e assinaturas; `stripe.completo = false` mantém bloqueado), incluir documentos/e-mails dos pagadores guardados, devolver `paidBy` e os ids das vendas, e reconhecer vínculo aprovado do negócio revalidando em `/cobrancas/{id}`.
  - Nova `rykapay-orphans`: mesma verificação de conta/usuário, lê `/cobrancas?limite=200&situacao=paga`, remove as já ligadas e as anteriores à data de corte, devolve só nome, valor, data, forma e id.
- Frontend:
  - `payWinGate.ts`: novos estados `awaiting_manager` e `paid_by_third_party` (este exige confirmação do vendedor); testes para cada regra (só "pago" libera, terceiro exige confirmação, pendente bloqueia).
  - `RequiredFieldsModal.tsx`: botão e diálogo de solicitação.
  - Tela de decisão do gestor (diálogo aberto pela notificação e lista de pendentes), no padrão dos diálogos ROY.
  - Aba Assinaturas: linha "Pago por".
  - Registro do vínculo automático dentro do fluxo de ganho já existente.
- Fora do escopo: WhatsApp para o gestor, cadastro em Financeiro > Pagadores, outros produtos, publicação.
