# Alinhar a Mentoria Ao Vivo com o número de clientes ativos

## O que está errado

A aba de Mentoria monta a lista com todo mundo cuja situação no cadastro é ativa, pausada ou em risco — isso dá 1.439 pessoas, sendo 1.037 apenas "risco de saída", muitas sem contrato nenhum.

A tela de Clientes usa outra régua: conta só quem tem contrato ativo. Conferi no banco: são exatamente 212, o mesmo número da sua tela.

## Como corrigir

A Mentoria passa a usar a mesma régua da tela de Clientes: só entra quem tem contrato ativo. O total passa de 1.439 para 212.

Com isso:

- Os cartões do topo (Membros ativos / Sem mentoria marcada) e as abas Em aberto / Realizadas passam a contar sobre esses 212.
- O seletor de programas passa a listar só os produtos desses contratos, com as contagens certas — e a soma dos programas bate com o total.
- O item "Sem programa" some na prática, já que todo contrato ativo tem produto; fica mantido só como rede de segurança caso algum contrato esteja sem produto informado.
- Presenças e agendamentos já registrados continuam intactos; quem sair da lista não perde histórico, apenas deixa de aparecer enquanto não tiver contrato ativo.

## Detalhes técnicos

Arquivo: `src/pages/MentoriaEC.tsx`, dentro de `membersQuery`.

- Inverter a ordem da montagem: buscar primeiro `client_contracts` com `account_id = accountId` e `status = 'active'` (paginado), extrair os `client_id` distintos e usar essa lista como universo.
- Buscar `clients` por `.in("id", ids)` em blocos de 200 (nome, foto, segmento), em vez de varrer a carteira inteira por `status`.
- Remover `ACTIVE_CLIENT_STATUSES` e o uso de `client_products` como origem de membros (o fallback "cliente sem contrato" deixa de existir). `products` continua sendo carregado para nome e cor do badge.
- `byClient` passa a vir só dos contratos ativos (mantendo a regra atual de maior `end_date` quando há mais de um).
- `ec_mentoring_attendance` e `ec_mentoring_client_status` seguem como estão, agora restritos aos ids do universo menor (menos consultas, menos risco de estouro de limite).
- `programOptions` e `totals` continuam derivando da lista já carregada, então se ajustam sozinhos.

Sem mudança de schema, RLS ou permissões.

Validação: `bun x tsgo --noEmit`, build, conferência de que o total exibido é 212 e que a soma das contagens do seletor de programas fecha com esse número.
