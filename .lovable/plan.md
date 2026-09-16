# Corrigir definitivamente a chegada das reações no RoyZapp

## Diagnóstico confirmado

Os eventos de reação estão chegando ao ROY e a mensagem alvo está sendo identificada. Porém, os registros reais entre 14:25 e 14:28 mostram repetidamente `target_source=messageid`, `emoji=empty` e resultado `removed`. Assim, toda reação recebida está sendo interpretada como remoção. A tabela `zapp_message_reactions` continua com zero registros, portanto não existe reação para a tela carregar.

Também foram identificadas fragilidades adicionais: reações pendentes podem ficar invisíveis sem reconciliação, a resolução de conversas diretas examina somente 500 registros, e uma reação enviada ao WhatsApp pode ser reportada como falha caso o espelhamento local falhe depois do envio.

## Correções

### 1. Capturar o emoji no formato real recebido
- Registrar temporariamente apenas a estrutura segura do evento: nomes e tipos dos campos relacionados à reação, sem mensagem, telefone, nome, token ou conteúdo da conversa.
- Ampliar o normalizador compartilhado para extrair o emoji do campo real usado pela instância, inclusive objetos e níveis aninhados hoje ignorados.
- Separar explicitamente três estados: reação adicionada com emoji válido, remoção explicitamente indicada pelo provedor e evento incompleto.
- Nunca tratar “emoji não encontrado” como remoção. Evento incompleto será registrado para diagnóstico e reconciliação, sem apagar reação existente.

### 2. Persistir e reconciliar sem perder eventos
- Gravar ou atualizar uma única reação por mensagem e autor quando houver emoji válido.
- Remover somente quando o payload trouxer evidência explícita de remoção.
- Reconciliar pendências tanto após inserção nova quanto quando a mensagem original já existir ou for detectada como duplicada.
- Corrigir a sincronização histórica para processar mensagens antes das respectivas reações e executar uma segunda etapa de reconciliação no fim de cada conversa.
- Resolver conversas pelo identificador externo e pela integração exata; remover a busca limitada aos primeiros 500 contatos e evitar vínculos ambíguos por sufixo.

### 3. Manter isolamento e consistência
- Restringir toda busca por conta, integração e conversa, inclusive em grupos e números com formatos alternativos.
- Preservar o ID completo armazenado e o ID canônico do WhatsApp como valores distintos, sem confundir o ID do evento com o ID da mensagem reagida.
- Tornar gravação, troca e remoção idempotentes para eventos repetidos do webhook e da sincronização.

### 4. Corrigir envio e remoção pelo ROY
- Rastrear cada clique até o gerenciador e registrar uma tentativa segura com operação, destino, integração e formato do ID, sem dados sensíveis.
- Aceitar a resposta real da versão da UAZAPI conectada sem considerar um retorno ambíguo como confirmação.
- Separar “WhatsApp confirmou” de “ROY espelhou”: se o envio ocorrer e a gravação local falhar, reconciliar o banco sem informar falsamente que o WhatsApp falhou.
- Na remoção, só apagar localmente após confirmação explícita do provedor ou do webhook; em falha, restaurar o estado visual e mostrar o motivo real.

## Validação ponta a ponta

- Reagir no WhatsApp com cada reação suportada e confirmar que aparece no balão correto do ROY.
- Trocar e remover no WhatsApp, confirmando atualização em tempo real sem criar balão comum.
- Criar, trocar e remover pelo ROY, confirmando o mesmo estado no WhatsApp e no banco.
- Testar mensagem recebida, enviada, conversa individual, grupo, evento duplicado e reação anterior à mensagem alvo.
- Repetir a sincronização histórica e confirmar idempotência: uma reação por autor, nenhuma pendência órfã e nenhum balão `[reação]`.
- Conferir registros finais: eventos adicionados devem terminar como `saved`, remoções explícitas como `removed` e eventos incompletos como `deferred`, nunca como remoção automática.
