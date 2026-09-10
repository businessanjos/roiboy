# Discador 3C persistente em Vendas e RoyZapp

## Objetivo
Disponibilizar o Discador 3C em todas as telas de Vendas e do RoyZapp para usuários com ramal configurado, mantendo o painel aberto durante a navegação e orientando automaticamente quando a 3C informar que o agente não está ocioso.

## Implementação
- Reativar o discador no layout global apenas nas rotas/setores de Vendas e RoyZapp.
- Exibir um botão fixo no canto inferior direito com o texto **Discador 3C**, o estado atual (Offline, Ocioso, Em chamada ou Pausa) e um botão **X** para ocultá-lo quando atrapalhar a visualização.
- Consultar o estado real do agente ao abrir a área e a cada 30 segundos, usando no servidor o token de serviço e o `X-Agent-Id`; nenhum token será enviado ao navegador.
- Exibir o painel da 3C em um drawer lateral persistente, usando `{domínio}/agent`, sem desmontá-lo em cada troca de página dentro dessas áreas.
- Mostrar o botão somente quando o usuário atual tiver ramal configurado.
- Tratar `AGENT_NOT_IDLE` nos botões de chamada da negociação e do RoyZapp com a mensagem: “Entre em uma campanha no Discador 3C (botão no canto da tela) e tente de novo”, abrindo o drawer automaticamente.
- Preservar o fallback atual do discador e os registros em `threecplus_call_logs`.

## Detalhes técnicos
- Acrescentar uma ação autenticada de status à função existente da 3C, reutilizando a resolução central de token de serviço e agente.
- Usar um evento global dedicado para abrir o drawer sem acoplar as telas de negociação/RoyZapp ao componente do painel.
- Mapear os estados detalhados da 3C para os quatro rótulos solicitados e manter atualização em tempo real quando eventos do agente estiverem disponíveis.
- Publicar apenas a função alterada e validar a interface nas rotas de Vendas e RoyZapp.
