# Produtividade por atendente: identificar tudo o que hoje está "sem atendente"

## O que os dados mostram hoje (Operações, últimos 30 dias)
Envios sem atendente identificado: cerca de 1.877. Quando abro esses envios, eles se dividem assim:
- 1.172 enviados direto pelo celular ou pelo WhatsApp Web, sem assinatura
- 558 enviados pelo "Canal | Eternum", que é o número do canal ou de transmissão
- 106 importados do histórico antigo
- 22 da "Automação CX", que são as mensagens automáticas
- 18 com assinatura no texto (Jessica Campos, Consultora Andréia), mas que não foram ligados à pessoa

Sobre "tirou o pessoal": nos dados, o único que saiu foi o Lucas dos Santos. Andréia, Camila, Maria, Lucas Suporte e Jessica Marcato continuam sendo contados. Se alguém específico sumiu, me diga o nome, que eu confiro.

## O que muda na tela
1. **"Sem atendente identificado" vira um grupo que dá para abrir**, com as linhas de origem e os mesmos números da tabela (Enviadas, Conversas, Média/dia):
   - Canal Eternum (número do canal)
   - Automação CX (mensagens automáticas)
   - Enviado pelo celular ou WhatsApp Web
   - Importado do histórico
   - Assinado, mas sem cadastro: aparece o nome da assinatura, como "Jessica Campos"
2. **Quando houver assinatura, o envio é ligado à pessoa.** Se a assinatura bate com o nome de alguém cadastrado, o envio passa para a linha dessa pessoa. Exemplo: "Consultora Andréia" vai para a Andréia Barros.
3. **Clicar numa linha**, seja de atendente ou de origem, abre a lista das conversas: contato, quantos envios, último envio e um botão para abrir a conversa. Assim dá para ver quem são esses enviados e essas conversas.
4. **Explicação curta da Média/dia** no cabeçalho: "conversas distintas ÷ dias em que a pessoa enviou mensagem".
5. **Lucas Suporte:** continua aparecendo, porque não é o Lucas dos Santos. Se ele também não é CS, eu tiro do mesmo jeito.

## Sem pesar o ROY
- O resumo por origem é calculado na mesma consulta que já existe, sem buscar mais nada no carregamento.
- A lista de conversas só é buscada quando você clica numa linha, de forma paginada e limitada ao período e à área.
- Nada é gravado nem alterado nas mensagens. É só uma forma de ler os dados existentes.

## Detalhes técnicos
- `zapp_productivity_metrics`: novo campo `unattributed_breakdown`, um agrupamento em `msgs` com `sender_user_id IS NULL` por categoria: `synced_from_history`, `sender_name` (Canal | Eternum / Automação CX), assinatura `^\*([^*|:]+)` e "celular" no restante. Leva enviadas, conversas e média/dia. A atribuição por assinatura usa um match (sem acento, case-insensitive) com `users.name` da conta, feito dentro da consulta e aplicado em `by_agent`, sem alterar `zapp_messages`. A exclusão do Lucas dos Santos continua.
- Nova RPC leve `zapp_productivity_agent_conversations(_sector, _from, _to, _integration, _include_groups, _user_id | _origin, _limit, _offset)`, SECURITY DEFINER com `zapp_can_view_analytics()`, que retorna conversas com contagem e último envio.
- `ZappAnalyticsPanel.tsx`: linha expansível "Sem atendente identificado", linhas clicáveis abrindo diálogo paginado (reaproveitando o padrão de `ZappAlertDetailDialog`) e tooltip da Média/dia.
