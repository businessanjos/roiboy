# Corrigir estados e segurança do Discador 3C

## Objetivo
Evitar que falhas de ligação desconectem o agente da campanha e usar o estado real da 3C antes de discar e nas duas interfaces de status.

## Alterações
- Remover o logout do tratamento de falha; executar `manual_call/exit` somente quando o agente estiver em modo manual.
- Consultar o agente antes da ligação e bloquear antecipadamente estados Offline e Intervalo com os códigos e mensagens solicitados.
- Manter a sequência click2call → manual_call apenas para agente Ocioso, sem alterar o fallback nem os registros de ligações.
- Abrir o Discador automaticamente também nos novos erros `AGENT_OFFLINE` e `AGENT_ON_BREAK`.
- Centralizar a classificação do estado real em Offline, Ocioso, Em chamada e Intervalo.
- Atualizar o botão flutuante e a tabela de Agentes a cada 30 segundos usando chamadas autenticadas no servidor.

## Validação
- Publicar as funções alteradas.
- Confirmar compilação sem erros.
- Verificar no navegador o botão, a tabela e a abertura automática do painel.
