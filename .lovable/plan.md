# Clínica Ryka: integração completa + painel de uso

## O que encontrei
- O ROY já busca a lista de clínicas da Ryka, mas a Ryka só manda dados de cadastro (nome, cidade, ativa/inativa). Ela **não manda nada de uso**: logins, usuários, leads, agendamentos.
- A última sincronização mostrou "0 clientes", mesmo com 204 acessos liberados. Preciso investigar isso primeiro.
- Sem dados de uso vindos da Ryka, não dá para saber quais clínicas "mais usam".

## Parte 1 — Lado Ryka (pedido para colar no projeto Clínica Ryka)
Criar no serviço que já atende o ROY uma ação nova, **uso das clínicas**, só de leitura e com a mesma chave de hoje. Ela devolve, por clínica:
- último login e número de pessoas ativas em 7 e 30 dias
- usuários cadastrados
- leads, agendamentos e consultas criados em 7 e 30 dias
- plano de ação: existe? última atualização
- módulos usados (marketing, vendas, clínico, ROYZAPP)

Eu escrevo o texto pronto com o formato exato da resposta.

## Parte 2 — Lado ROY
1. **Corrigir a sincronização** para voltar a casar as clientes com as clínicas e mostrar o erro real quando falhar.
2. **Guardar o uso** de cada clínica uma vez por dia, com histórico, para comparar meses. Fica visível só para quem já vê a aba Clínica Ryka.
3. **Painel novo no topo da aba Clínica Ryka** (abas "Painel" e "Clientes"):
   - Números: clínicas ativas, sem login há 7, 15 ou 30+ dias, nunca acessaram, liberadas sem uso
   - Ranking das clínicas que mais usam (pontuação de uso)
   - Lista de risco: inativas e em queda, com consultora responsável e produto
   - Uso por produto (EC x Rykas Mentoring) e por consultora
   - Evolução mensal de clínicas ativas
   - Filtros: período, produto, consultora, situação
4. **Atualização automática diária**, além do botão "Sincronizar com Ryka".
5. Os botões dos Processos continuam abrindo direto na clínica da cliente (já está pronto).

## Ordem
Parte 2.1 e o painel com os dados que já temos (ativa/inativa, último login, liberação) entram agora. As métricas de uso aparecem quando a Ryka criar a ação da Parte 1.

## Não muda
As permissões de quem vê o quê, os acessos já liberados e a regra de quem pode liberar continuam iguais. Nenhuma chave secreta aparece na tela.
