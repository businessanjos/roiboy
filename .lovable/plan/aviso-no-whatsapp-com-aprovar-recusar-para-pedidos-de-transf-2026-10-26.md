# Aviso no WhatsApp com Aprovar / Recusar para pedidos de transferência

## O que o gestor recebe
Quando o Darlan (ou outro vendedor) pede um negócio, o gestor recebe pelo WhatsApp do Comercial uma mensagem assim:

```text
Pedido de transferência de negócio
Darlan Ferreira pediu: [ORG-BP] Vanessa Fonseca
Etapa: Novo Lead · Hoje com: Jonathan Marcato
Motivo: "cliente já falou comigo pelo Instagram"

[ Aprovar ]   [ Recusar ]
```

- Os dois botões aparecem na mensagem. Mas o WhatsApp não oficial nem sempre mostra botões (às vezes falham no iPhone e no WhatsApp Web). Por isso, a mensagem também leva dois links curtos, "Aprovar" e "Recusar", que funcionam sempre.
- **Tocar no botão** já registra a decisão na hora, sem abrir o ROY.
- **Tocar no link** abre o ROY numa tela simples de confirmação, com o login do gestor.
- Cada pedido só pode ser decidido uma vez. Se alguém tocar de novo, a resposta é "Esse pedido já foi aprovado/recusado".

## O que acontece depois da decisão
- **Aprovado:** o negócio passa para o Darlan na hora, ele já consegue abrir e fica registrado no histórico do negócio.
- **Recusado:** nada muda e ele continua sem acesso.
- Nos dois casos, o Darlan recebe o aviso no sino e o aviso na tela, como já acontece hoje. Ele também acompanha tudo na tela **Transferências**: pedidos pendentes, aprovados e recusados.
- O gestor recebe uma confirmação curta no WhatsApp: "Aprovado: negócio transferido para Darlan".

## Quem recebe no WhatsApp
- Os mesmos gestores que já recebem a notificação no sistema, usando o telefone do cadastro de cada um. Quem não tiver telefone cadastrado recebe só pelo sistema.
- O envio sai pelo número do Comercial, o mesmo do relatório diário.

## Segurança
- Só um gestor consegue aprovar. A resposta pelo botão vale apenas se vier do telefone de um gestor cadastrado. O link exige login de gestor.
- Os links expiram em 7 dias e não mostram nenhum dado sensível.
- Os limites atuais de envio do WhatsApp são respeitados. A mensagem é sempre diferente, porque leva nome e negócio.
- A conversa desse aviso não entra nas métricas de produtividade.

## Detalhes técnicos
- Nova edge function `deal-transfer-whatsapp`:
  - É chamada logo após `request_deal_transfer`, pelo frontend, com o `request_id`.
  - Busca os gestores (`can_manage_spiff_payments`) e os telefones em `users.phone`.
  - Envia pela instância `vendas`, via uazapi `/send/menu` (type `button`, ids `dtr:approve:<id>` / `dtr:reject:<id>`). Se falhar, cai para `/send/text` com os links.
- Nova coluna `deal_transfer_requests.decision_token`, com hash e expiração, para os links. Nova rota `/transferencia/:token` com confirmação, que usa o login e chama `decide_deal_transfer`.
- `uazapi-webhook`: reconhece a resposta de botão com id `dtr:*`. Valida o telefone do remetente contra um gestor da conta e chama uma nova RPC `decide_deal_transfer_by_manager(request_id, manager_user_id, approve)`, só para service_role e com a mesma lógica da atual. Depois responde a confirmação. Essa mensagem não vira conversa de atendimento nas métricas.
- `decide_deal_transfer` passa a delegar para essa função interna, para manter uma regra só.
- `zapp_internal_contacts` passa a incluir os telefones dos gestores, para ficarem fora das métricas.
- Teste PGlite: aprovar transfere e notifica o vendedor, recusar não transfere, segunda decisão é bloqueada, e quem não é gestor é rejeitado.
