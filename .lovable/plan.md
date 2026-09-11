# Corrigir estado e chamada individual da 3C

## Objetivo
Eliminar a divergência entre o status mostrado no Discador e o estado usado antes da chamada, tratar campanhas preditivas corretamente e preservar a sessão do iframe.

## Implementação
- Criar em `_shared/threecplus.ts` uma única leitura de estado que consulta `GET /api/v1/agent` e a campanha logada, registra status HTTP e JSON bruto sem expor tokens, e retorna um estado normalizado.
- Mapear somente campos estruturados conhecidos (`status`, `agent_status`, `state` e `mode`), com fallback para online/ocioso quando a resposta do agente for 200 e houver campanha logada.
- Substituir os leitores duplicados de `threecplus-call`, `threecplus-agent` e status da tabela pelo helper compartilhado.
- Ajustar a chamada para `click2call` e, quando necessário, `manual_call/enter` seguido de `manual_call/dial`; mapear a recusa da campanha preditiva para `MANUAL_NOT_ALLOWED` com a mensagem solicitada.
- Fazer RoyZapp e negociações abrirem o drawer também em `MANUAL_NOT_ALLOWED`.
- Manter o iframe montado ao fechar o drawer e mover o Discador para um ponto global estável do layout, ocultando-o fora de Vendas/RoyZapp sem desmontá-lo durante a navegação autenticada.
- Preservar o fallback existente e os registros em `threecplus_call_logs`.

## Validação
- Publicar as funções afetadas e verificar os logs da leitura real do agente.
- Validar que o status do botão e a decisão da chamada coincidem.
- Confirmar no navegador que fechar o drawer e navegar entre Vendas/RoyZapp não recria o iframe.
- Confirmar compilação sem erros.
