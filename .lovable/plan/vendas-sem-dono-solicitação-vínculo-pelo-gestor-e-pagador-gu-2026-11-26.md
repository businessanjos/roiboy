# Vendas sem dono: solicitação, vínculo pelo gestor e pagador guardado na ficha

Vale somente para o Programa Clínica Ryka, onde a trava de pagamento já existe. A regra "sem pagamento confirmado, ninguém libera" continua: o gestor não libera o ganho no escuro, ele aponta qual venda paga pertence ao negócio.

## O que foi conferido (somente leitura)

- A assinatura da Winny Figueiredo Scalzer (esposa do Saulo) aparece no RykaPay pelo e-mail dela: ativa, R$ 2.500, com 2 cobranças aprovadas. Ou seja, o pagamento existe; só falta ligar ao negócio do Saulo.
- O ROY hoje ignora as vendas antigas da Stripe que o RykaPay devolve. Por isso o ganho do Saulo continuaria travado mesmo com o e-mail certo.
- Sua planilha tem 47 assinaturas da Stripe: 10 ativas, 1 em atraso e 1 suspensa (12 vivas); as outras 35 não pagaram ou foram canceladas. Das 12 vivas, 5 têm e-mail que já existe no ROY e 7 não batem com ninguém.
- A lista geral de cobranças do RykaPay traz nome de quem pagou, valor, data, forma e situação (57 cobranças, 26 pagas). Não traz CPF nem e-mail.
- O ROY não guarda hoje qual venda pertence a qual negócio. Sem isso não há como saber o que está sem dono.

## Duas origens de vendas sem dono

1. **Legado da Stripe (uma vez só)**: as 12 assinaturas vivas da planilha entram como lista fechada. Conforme forem vinculadas, somem. Quando acabar, a Stripe some do ROY; nada novo entra por ela.
2. **RykaPay (daqui em diante)**: vendas pagas no RykaPay, criadas a partir da data em que isso entrar no ar, que não foram registradas em nenhum negócio. Vendas antigas não entram, para a lista não nascer com as 26 já pagas.

## Como vai funcionar

1. **Ganho normal (pagador é o próprio cliente)**
   - Nada muda para o vendedor. Ao confirmar o pagamento, o ROY passa a registrar "esta venda é deste negócio", e ela nunca aparece como sem dono.
   - Quem está no legado da Stripe com o próprio e-mail (os 5 que batem) também é reconhecido sozinho.

2. **Pagamento não encontrado**
   - No aviso âmbar aparece o botão **Solicitar ao gestor**.
   - O vendedor vê a lista das vendas sem dono (nome de quem pagou, valor, data, origem), pode marcar a que acredita ser a dele e escrever uma observação.
   - O ganho segue bloqueado, com o aviso "Aguardando o gestor".

3. **Gestor recebe e vincula**
   - Chega a notificação no sininho (e no celular, pelo aviso que já existe), com link direto.
   - Ele vê o negócio e **a lista inteira das vendas sem dono**, com a sugestão do vendedor apenas destacada no topo, não como única opção.
   - Escolhe a venda certa e informa a relação: **Sócio, Marido/Esposa, Cartão da empresa ou Outro (escreve)**.
   - Pode recusar com motivo; o vendedor é avisado nos dois casos.
   - Ao vincular, o ROY confere de novo no RykaPay se está pago. Só então grava.

4. **Vendedor dá o ganho**
   - Ao clicar em "Verificar de novo", o card verde aparece com "Pago por Winny Figueiredo Scalzer (Esposa)" e o ganho é liberado com as demais validações de sempre.

5. **Pagador fica na ficha**
   - O pagador e a relação ficam guardados no lead e passam para o cliente no ganho, visíveis na aba Assinaturas.
   - Nas próximas vendas, o ROY já consulta também os dados desse pagador. Se achar pagamento por ele, mostra "Pago por Winny (Esposa). Foi ela que pagou?" e o vendedor confirma antes de seguir, sem precisar do gestor de novo.

## Quem pode vincular

Administradores e gestores comerciais (Jonathan). Vendedor só solicita e só vê as próprias solicitações.

## Pontos de atenção

- **Lista do RykaPay só com nome**: sem CPF/e-mail na listagem, o gestor identifica pelo nome, valor e data. Ao vincular, ele pode informar CPF ou e-mail do pagador (opcional); com isso as próximas vendas são reconhecidas sozinhas.
- **Assinatura mensal no cartão pelo checkout do RykaPay**: ainda preciso confirmar se aparece na lista geral de cobranças; é o primeiro passo da construção. Se não aparecer, o gestor vincula informando o e-mail ou CPF de quem pagou.
- **Legado da Stripe**: entram só as 12 assinaturas vivas. As 35 que não pagaram ou foram canceladas ficam de fora.
- A lista é montada na hora em que alguém abre, sem rotina em segundo plano, já que os casos são raros.

## Detalhes técnicos

- Novas tabelas, com RLS por conta e GRANTs:
  - `pay_orphan_seed`: legado da Stripe importado da planilha (id da assinatura, nome, e-mail, valor, início, situação); sem cartão, telefone ou taxas.
  - `pay_sale_links`: venda (id externo, origem `rykapay` ou `stripe_legacy`, valor, data, nome do pagador) ligada a `deal_id`; única por conta + venda; marca se foi automática ou pelo gestor.
  - `pay_link_requests`: negócio, solicitante, venda sugerida, observação, situação (pendente/aprovada/recusada), quem decidiu, motivo.
  - `pay_third_party_payers`: lead e/ou cliente, nome, documento e e-mail opcionais, relação (`partner`, `spouse`, `company_card`, `other` + texto), quem aprovou. Trigger no ganho copia do lead para o cliente.
- Decisões por RPC `SECURITY DEFINER` com checagem de papel (`request_pay_link`, `decide_pay_link`), que também inserem em `notifications` (o push existente dispara pelo trigger atual).
- Funções de backend:
  - `rykapay-read`: ler o bloco `stripe` da resposta (assinatura ativa com cobrança aprovada; `stripe.completo = false` mantém bloqueado), incluir e-mails/documentos dos pagadores guardados, devolver `paidBy` e os ids das vendas, e reconhecer vínculo aprovado do negócio revalidando no RykaPay (`/cobrancas/{id}` ou e-mail do pagador).
  - Nova `rykapay-orphans`: mesma verificação de conta/usuário, junta `/cobrancas?limite=200` pagas após a data de corte com o legado ainda não vinculado, remove as já ligadas e devolve só nome, valor, data, origem e id.
- Frontend:
  - `payWinGate.ts`: novos estados `awaiting_manager` e `paid_by_third_party` (este exige confirmação do vendedor); testes para cada regra (só "pago" libera, terceiro exige confirmação, pendente bloqueia).
  - `RequiredFieldsModal.tsx`: botão e diálogo de solicitação.
  - Tela de decisão do gestor (aberta pela notificação e lista de pendentes), no padrão dos diálogos ROY, com a lista completa.
  - Aba Assinaturas: linha "Pago por".
  - Registro do vínculo automático dentro do fluxo de ganho já existente.
- Fora do escopo: WhatsApp para o gestor, cadastro em Financeiro > Pagadores, outros produtos, publicação.
