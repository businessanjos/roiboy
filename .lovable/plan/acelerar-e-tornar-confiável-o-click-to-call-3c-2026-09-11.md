# Acelerar e tornar confiável o click-to-call 3C

## Objetivo
Reduzir o tempo entre clique e discagem, impedir números truncados e garantir uma única tentativa real por clique, mantendo o registro local, a conciliação posterior e o fallback controlado.

## Implementação
- Centralizar a preparação do telefone no utilitário compartilhado: somente dígitos, remover zero inicial, adicionar DDI 55 quando ausente e inserir o nono dígito apenas no caso brasileiro válido. Rejeitar qualquer resultado fora de 12–13 dígitos iniciados por 55 com `Número inválido: X`.
- Reutilizar no pedido de chamada o estado publicado pelo último poll do Discador quando tiver até 20 segundos; caso contrário, consultar a 3C uma única vez.
- Enviar junto ao pedido os dados recentes do estado e da campanha sem confiar cegamente no navegador; o servidor valida idade, usuário/agente e estados bloqueantes.
- Para agente ocioso na campanha manual, usar diretamente `manual_call/enter` e `manual_call/dial`; se já estiver em modo manual, usar somente `dial`.
- Fora de campanha manual, fazer apenas uma tentativa de `click2call`. Remover login de webphone, cleanup, sleeps fixos e a cascata click2call → manual. Rodar `agent/connect` fora do caminho bloqueante.
- Aplicar retry somente a timeout/5xx, no máximo uma vez para a mesma operação, sem criar uma segunda tentativa lógica de ligação.
- Criar o registro “Ligação em andamento” imediatamente ao clicar e atualizar esse mesmo registro com sucesso ou falha; o botão passa para “Discando…” no mesmo instante.
- Registrar no histórico o telefone exato enviado, endpoint usado, status e mensagem bruta sanitizada da 3C. Exibir a mensagem no painel de Telefonia.
- Usar a mesma normalização no click-to-call, sincronização, RoyZapp e negociação, preservando a deduplicação e `threecplus_call_logs`.

## Validação
- Testar os números citados e casos com/sem DDI, zero inicial e nono dígito.
- Confirmar que Prospecção Manual faz somente `enter → dial`, ou apenas `dial` quando o modo manual já está ativo.
- Confirmar que não existem sleeps, login, cleanup ou click2call antes do dial manual.
- Publicar as funções alteradas e verificar compilação, logs reais da 3C e exibição do erro no painel.
