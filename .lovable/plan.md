# Checkpoints: contar conversas em grupo do WhatsApp

## O que está acontecendo (confirmado no banco)
A tela de Checkpoints já considera as conversas do RoyZapp como interação, mas só as conversas **individuais** que estão ligadas a um cliente. Os **grupos** nunca ficam ligados a nenhum cliente:

- Grupos no RoyZapp: 177 (83 com mensagem nos últimos 30 dias) e **0 ligados a um cliente**.
- Exemplo: "Wanessa Lopes e Juliano" teve mensagem hoje às 15:50, mas o grupo não está ligado à Wanessa, então o Checkpoints só enxerga a conversa individual dela, parada em 21/08.
- O mesmo acontece com "Luciana Lima e Rafaela", "Karina Batai & Vinícius & Marcelo - RM", "Marcelo Araújo & Drª Natália (Eclair)".

Como a Andréia atende boa parte das clientes por grupo, a carteira dela aparece cheia de "Vencido" mesmo com conversa em dia.

Tem também clientes cadastradas em dobro (Karina Batai Martins e Isabela Rocha aparecem duas vezes), o que divide o histórico entre as duas fichas.

## O que vou fazer
1. **Ligar grupo a cliente(s)**: um grupo pode ser ligado a um ou mais clientes (ex.: casal ou sócios no mesmo grupo).
2. **Ligação automática**: o ROY confere os números de quem participa e manda mensagem no grupo; se o número for de um cliente cadastrado, liga o grupo a ele. Roda agora para os grupos atuais e passa a rodar sozinho para grupos novos.
3. **Ligação manual no RoyZapp**: no topo da conversa em grupo, opção "Clientes deste grupo" para incluir ou tirar clientes, para os casos que a ligação automática não acertar.
4. **Checkpoints passa a contar o grupo**: a última mensagem no grupo conta como última interação de cada cliente ligado.
5. **Lista de duplicados**: mostrar quais clientes estão cadastrados em dobro, para a equipe juntar as fichas (a junção é feita pela ferramenta já existente; não apago nada sozinho).

## Depois de pronto
Abro o Checkpoints com a carteira da Andréia e confiro se Wanessa, Luciana, Karina e Eclair saem de "Vencido" quando têm conversa recente no grupo.

## Detalhes técnicos
- Nova tabela `zapp_group_clients (account_id, conversation_id, client_id, source 'auto'|'manual', created_by)`, única por (conversation_id, client_id), com GRANT + RLS por account_id.
- Ligação automática: casar o telefone de quem envia as mensagens do grupo com os telefones dos clientes (mesma normalização usada no RoyZapp), somente clientes da mesma conta; nunca remove ligações manuais.
- `client_last_live_activity` passa a incluir `max(sent_at)` das mensagens dos grupos ligados via `zapp_group_clients`.
- Nenhuma mudança nas regras de quem pode ver o quê.
