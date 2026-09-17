# Corrigir a Mentoria Ao Vivo zerada

## O que está acontecendo

A tela passou a montar a lista a partir de toda a carteira ativa (mais de 1.400 clientes). Para cruzar contratos, produtos e presenças, ela envia a lista inteira de clientes dentro do próprio endereço da consulta. Esse endereço fica gigante e o servidor recusa o pedido — verifiquei no navegador: as consultas de contratos, produtos do cliente, presenças e situação da mentoria voltam todas com erro. Como uma delas falha, a tela não monta nada e mostra tudo zerado.

## Como corrigir

1. Parar de enviar a lista de clientes dentro da consulta. Buscar contratos, produtos vinculados, presenças e situação da mentoria filtrando pela conta (o próprio sistema já limita o que cada pessoa enxerga) e cruzar os dados na tela.
2. Onde não existir filtro por conta, quebrar a busca em blocos de no máximo 200 clientes por vez, feitos em paralelo, e juntar os resultados.
3. Se mesmo assim alguma dessas buscas complementares falhar, a lista de clientes deve continuar aparecendo (sem programa/presença naquele item) em vez de zerar a tela inteira.
4. Conferir no navegador que os totais voltam a aparecer e que o seletor de programas lista os produtos com as contagens certas.

## Detalhes técnicos

`src/pages/MentoriaEC.tsx`, dentro de `membersQuery`:

- Remover `.in("client_id", clientIds)` de `client_contracts`, `client_products`, `ec_mentoring_attendance` e `ec_mentoring_client_status`.
- `client_contracts` e `ec_mentoring_client_status`: manter apenas `.eq("account_id", accountId)`.
- `client_products` e `ec_mentoring_attendance` não têm coluna de conta: usar um helper `chunk(clientIds, 200)` com `Promise.all` por bloco e concatenar as linhas.
- Trocar os `throw` das consultas auxiliares por log no console, mantendo `throw` só na consulta de `clients`.
- Nenhuma mudança de schema, RLS ou permissões.
