# Corrigir definitivamente as reações no RoyZapp

Os testes mais recentes confirmam que o problema continua nos dois sentidos:

- Ao reagir pelo WhatsApp, o evento chega ao ROY, mas o identificador da mensagem original não é extraído. O banco continua sem nenhuma reação salva.
- Ao reagir ou remover pelo ROY, aparece “Não foi possível enviar a reação”, porém não existe chamada correspondente no gerenciador de envio. A ação está falhando antes de chegar ao WhatsApp.

## Correções

### 1. Capturar o formato real da reação recebida
- Registrar somente a estrutura segura do evento de reação: nomes dos campos, presença, tamanho e formato dos identificadores, sem texto, telefone, token ou conteúdo da conversa.
- Tratar o formato plano recebido atualmente, inclusive quando `quoted` não contém o alvo e ele vem em outro nível do evento, da conversa ou da chave interna da reação.
- Separar obrigatoriamente o ID do evento de reação do ID da mensagem reagida, impedindo que o emoji seja salvo como uma mensagem comum.
- Normalizar o ID alvo para o mesmo padrão usado nas mensagens do ROY (`número:id`), mantendo busca exata por conta e conversa antes do fallback por sufixo.

### 2. Garantir persistência e reconciliação
- Quando a mensagem original for localizada, criar, trocar ou remover exatamente uma reação vinculada a ela.
- Quando o evento chegar antes da mensagem, guardar a reação pendente com todos os dados necessários e reconciliá-la após a mensagem ser salva.
- Corrigir erros de gravação hoje ocultos pelo retorno “processada”, fazendo o registro distinguir reação salva, pendente, removida ou rejeitada.
- Manter isolamento por conta, conexão e conversa, inclusive quando existirem IDs repetidos em conversas diferentes.

### 3. Fazer o clique do ROY chegar ao WhatsApp
- Rastrear o clique desde o seletor do emoji até a chamada de envio e corrigir o ponto que interrompe a ação antes do gerenciador.
- Garantir que a conversa forneça a conexão exata, o destino correto e o ID externo da mensagem ao comando.
- Em conversas individuais, usar o telefone normalizado; em grupos, usar o identificador do grupo.
- Mostrar no aviso o motivo retornado pelo envio, sem reduzir falhas diferentes à mensagem genérica atual.

### 4. Remover a reação de verdade
- Enviar a remoção pelo mesmo endpoint, conexão, destino e ID canônico usados na criação, com o valor de remoção aceito pela UAZAPI.
- Validar a resposta real da UAZAPI antes de apagar a reação local; uma resposta HTTP bem-sucedida não será suficiente se o corpo não confirmar a operação.
- Aguardar a confirmação recebida pelo webhook ou consultar o estado da mensagem quando necessário.
- Em falha, restaurar o emoji no ROY e informar o motivo; em sucesso, remover a mesma linha local sem deixar o WhatsApp divergente.

## Validação ponta a ponta

- Reagir pelo WhatsApp em mensagem recebida e enviada; confirmar que o emoji aparece no balão correto do ROY, sem criar novo balão.
- Trocar e remover a reação no WhatsApp; confirmar atualização automática no ROY.
- Criar, trocar e remover pelo ROY; confirmar cada ação no WhatsApp e no banco.
- Testar conversa individual e grupo, além de mensagem cujo ID esteja duplicado em outra conversa.
- Confirmar nos registros que cada clique gera uma única tentativa, usa a conexão correta e termina com confirmação ou erro explícito.
