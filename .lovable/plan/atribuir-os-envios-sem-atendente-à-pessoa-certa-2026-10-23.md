# Atribuir os envios "sem atendente" à pessoa certa

## O que foi encontrado
- As mensagens assinadas "Consultora Andréia | Eternum" da conversa do Jhonata Cappellaro já contam para a Andréia.
- A conversa aparece em "Sem atendente identificado" por causa de outras mensagens, enviadas pelo celular / WhatsApp Web sem assinatura (ex.: 15/10, "BOOOMMMM DIAAAA MEU POVO", "Ta tudo bem ai", "kkkkk").
- O setor de Operações usa um único número de WhatsApp para todas as consultoras. Por isso o número não diz quem mandou.
- Últimos 30 dias: 1.174 envios pelo celular sem atendente, em 124 conversas. Em cerca de 998 deles (85%), outra mensagem identificada de alguém da equipe foi enviada na mesma conversa até 7 dias antes ou depois.

## Regra nova
Quando um envio feito pelo celular não tem atendente, o ROY procura quem é o dono da conversa naquele momento, nesta ordem:
1. A última pessoa identificada que enviou mensagem na mesma conversa antes desse envio, até 7 dias antes.
2. Se não houver, a próxima pessoa identificada que enviou depois, até 7 dias depois.
3. Se não houver, o atendente responsável pela conversa na fila.
4. Se nada disso existir, o envio continua em "Sem atendente identificado".

O que continua igual:
- Importados do histórico, Canal Eternum e Automação CX seguem como estão. Eles não são envios de uma pessoa.
- Lucas dos Santos e os contatos e grupos da empresa continuam fora.
- Nenhuma mensagem é alterada. A regra só muda a forma de contar.

## O que muda na tela
- Os números de Enviadas, Conversas, Média/dia, Novas iniciadas, Respostas e Resposta (mediana) passam a incluir esses envios.
- Ao clicar no número de uma pessoa, a lista mostra também essas conversas. Elas ganham uma etiqueta discreta "pelo celular" para indicar que foram atribuídas pela conversa.
- "Sem atendente identificado" fica só com o que realmente não tem dono. Pela conta acima, deve cair de cerca de 1.170 para menos de 200 envios nos últimos 30 dias.
- Depois de aplicar, eu confiro no banco que, por período, a soma por atendente mais "sem atendente" é igual ao total de Enviadas.

## Detalhes técnicos
- Nova função SQL `zapp_infer_sender(_cid, _sent_at)`, STABLE e SECURITY DEFINER. Ela usa o índice por conversa e data para achar o envio identificado anterior ou posterior dentro de 7 dias. Na falta dele, usa o `agent_id` mais recente de `zapp_conversation_assignments`, convertido para `user_id` por `zapp_agents`.
- Em `zapp_productivity_metrics`, `zapp_productivity_contacts` e `zapp_productivity_agent_conversations`, a etapa `dedup` passa a usar: identificado direto, senão assinatura, senão (só quando a origem seria `device`) o atendente inferido. Uma marca `inferred` é levada até o resultado.
- Essa inferência é calculada só para os envios de origem `device` dentro do período, para não pesar o carregamento.
- A interface lê `inferred` para mostrar a etiqueta. Não há outra mudança de tela.
