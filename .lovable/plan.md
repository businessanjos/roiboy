# Chave de TV abrindo a mesma tela de Insights logada

## O que muda para você
- Com `?tv_token`, a TV abre exatamente a tela de Insights em modo TV que ela mostra hoje logada: mesmo layout, mesmos gráficos (pílulas EM/EC, E-Pass escondido), selo e título do modo TV, e os mesmos parâmetros (periodo, setor, foco, tv=0/1, zoom).
- A tela "limpa" atual da chave (caminho do link compartilhado) sai.
- Atualização dos dados igual à tela logada, porque é o mesmo código.
- Continua só leitura, com validação no servidor.

## Como funciona
A chave passa a ser uma "conta de TV" que só consegue ler:
1. A TV abre o link com a chave. O Roy monta a tela de Insights normal.
2. Toda busca de dados dessa tela vai para uma função do servidor, que confere a chave a cada pedido.
3. A função só aceita leituras (consultas e funções de leitura de uma lista fechada). Qualquer gravação, upload ou mudança é recusada no servidor.
4. A função busca os dados com as permissões da conta que as TVs usam hoje logadas, então os números saem iguais. Essa sessão fica só no servidor; a TV nunca recebe login de verdade.

## Preciso de você
- Qual conta as TVs usam hoje logadas (e-mail). Ela define o que o painel enxerga.
- A senha dessa conta guardada como segredo no servidor (pedido por um cartão seguro, nunca no chat). Se preferir, crio uma conta "TV Escritório" com o mesmo perfil.

## Depois de pronto
Comparo lado a lado, com e sem chave, os painéis 05fe3fc0, a920cd07, 29104b57 e 77cb0a0e (fotos das duas versões) e digo qualquer diferença. Não publico sem autorização.

## Detalhes técnicos
- Nova edge function `tv-proxy`: valida `tv_token` (mesmo HMAC de `_shared/tvToken.ts`), permite só GET/HEAD em `/rest/v1/*` e POST em `/rest/v1/rpc/<allowlist>`; encaminha com JWT da conta de TV (sign-in server-side, cache em memória); atualiza `last_used_at`.
- No front, quando há `tv_token` sem sessão, um cliente Supabase com `fetch` customizado redireciona REST/RPC para `tv-proxy`; `useCurrentUser`/permissões recebem o perfil da conta de TV via `tv-proxy` (ação `whoami`). Realtime desligado nesse modo (os refetch intervals existentes seguem).
- `TvInsightsView` e a ação `tv_load` do `shared-insights` são removidas; regra no AGENTS.md atualizada.
