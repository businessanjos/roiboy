# Discador 3C só para quem tem ramal

## Problema
Hoje o botão "Discador 3C" aparece para qualquer usuário das áreas de Vendas e RoyZapp, mesmo sem ramal — mostrando o aviso "Ramal não configurado". Consultoras, marketing e CS veem um botão inútil ocupando a tela.

## O que muda
- O botão e a janela do discador só aparecem para quem tem ramal configurado na 3C (hoje: Maikol, Everton, Darlan e Jonathan).
- Quem não tem ramal não vê nada: sem botão, sem aviso, sem atalho de configuração.
- Para quem tem ramal, nada muda: janela flutuante, arrastar, redimensionar, recolher no X e memória de posição seguem iguais.

## Detalhes técnicos
- Em `ThreeCPlusPanel.tsx`, trocar a condição `canUseDialer = hasExtension || accountConnected` por apenas `hasExtension`.
- Remover o estado visual de "Ramal não configurado" e o link para Configurações, que deixa de existir.
- Manter o consumo de `get_extension` do `threecplus-agent` (inclusive `account_connected`, que continua útil para o painel em si) e todo o fluxo de chamada, fallback e registros em `threecplus_call_logs`.
