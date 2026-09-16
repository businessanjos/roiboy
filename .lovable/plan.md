# Corrigir envio e remoção de reações no RoyZapp

Os registros atuais confirmam dois problemas distintos: uma reação recebida às 10:00 chegou identificada como `reaction`, mas foi salva como mensagem comum porque o vínculo com a mensagem original não foi extraído; além disso, a tabela de reações continua vazia. No envio pelo ROY, o endpoint usado é o correto, porém ainda falta confirmar o identificador aceito pelo WhatsApp e não considerar uma resposta genérica como confirmação de aplicação ou remoção.

## Correções

### 1. Interpretar o evento real sem transformá-lo em mensagem
- Capturar o conteúdo estrutural seguro de `reaction`, `quoted`, `messageid` e campos relacionados no formato real recebido, sem registrar texto de conversas, telefones ou credenciais.
- Extrair separadamente o ID do evento e o ID da mensagem reagida, incluindo o formato em que `reaction` ou `quoted` não é um objeto no primeiro nível.
- Interromper obrigatoriamente o fluxo de mensagem comum sempre que o tipo for `reaction`, mesmo se a reação estiver incompleta. Assim, um emoji nunca aparecerá como novo balão.
- Gravar, trocar ou remover a reação vinculada à mensagem original; se a mensagem ainda não existir localmente, manter a reação pendente para reconciliação.

### 2. Usar o ID correto ao reagir pelo ROY
- Separar o ID armazenado no ROY (`telefone:id`) do ID que o endpoint de reação realmente espera.
- Enviar primeiro o identificador canônico confirmado pelo formato da instância e usar uma alternativa controlada apenas quando a resposta indicar ID inválido, sem gerar uma segunda reação.
- Manter a conexão exata e o destino da conversa; em grupos, usar o identificador do grupo.

### 3. Tornar a remoção confiável
- Enviar a remoção com texto vazio para a mesma mensagem e pela mesma conexão usada na reação original.
- Não apagar definitivamente a reação da tela apenas porque a chamada retornou HTTP 200; validar o corpo da resposta e a confirmação recebida do WhatsApp.
- Enquanto a remoção estiver pendente, manter um estado visual temporário. Em falha ou ausência de confirmação, restaurar o emoji e mostrar o motivo real.
- Garantir idempotência para cliques repetidos: uma ação em andamento por mensagem, sem duplicar envio.

### 4. Sincronizar os dois lados
- Quando o WhatsApp confirmar criação, troca ou remoção, atualizar a mesma linha de reação e eliminar qualquer balão incorreto criado anteriormente para aquele evento.
- Fazer a atualização em tempo real preservar o estado pendente até chegar a confirmação correspondente, evitando que uma leitura vazia faça o emoji sumir antes da hora.

## Validação

- Reagir pelo WhatsApp e confirmar que aparece somente como emoji no balão correto do ROY.
- Reagir pelo ROY e confirmar no WhatsApp sem criar uma mensagem de emoji separada.
- Remover pelo ROY e confirmar que desaparece nos dois lados; simular falha e confirmar o retorno visual do emoji.
- Trocar emoji, repetir clique rápido e testar mensagem recebida, enviada e conversa em grupo.
- Conferir nos registros que cada operação usa a conexão e a mensagem corretas e deixa exatamente uma reação persistida, ou nenhuma após remoção.
