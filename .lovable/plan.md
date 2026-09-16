# Corrigir definitivamente as reações no RoyZapp

A interface já tem os emojis, mas o problema está antes dela: o banco continua com **zero reações** e o registro real das 09:31 mostra `Sem id da mensagem alvo, ignorando`. Ou seja, o WhatsApp envia a reação, porém o webhook não reconhece onde a UAZAPI colocou o identificador da mensagem reagida. Além disso, o canal oficial da Meta ainda descarta reações explicitamente.

## Correções

### 1. Interpretar o formato real recebido
- Ajustar o webhook da UAZAPI para reconhecer os formatos de reação realmente usados pela integração, incluindo os objetos aninhados `reactionMessage`, `message.reactionMessage`, `content.reactionMessage` e suas chaves de mensagem.
- Corrigir também o segundo caminho de entrada (`data.messages[]`): hoje ele trata mensagens comuns, encontra reação sem texto e a descarta antes do processamento.
- Separar corretamente:
  - ID do próprio evento de reação;
  - ID da mensagem que recebeu a reação;
  - emoji, inclusive vazio para remoção;
  - autor da reação e sentido recebido/enviado.
- Registrar diagnóstico seguro somente com nomes de campos e resultado do vínculo, sem conteúdo de conversa ou credenciais, para futuras variações não voltarem a falhar silenciosamente.

### 2. Vincular à mensagem certa com segurança
- Normalizar os IDs compostos da UAZAPI antes da busca e tentar primeiro igualdade exata por conta e integração.
- Usar correspondência por sufixo apenas como fallback controlado e exigir resultado único, evitando associar uma reação à mensagem de outra conta ou conversa.
- Se a reação chegar antes da mensagem original, guardá-la pelo ID externo e reconciliá-la assim que a mensagem for salva, em vez de descartá-la.

### 3. Cobrir também o WhatsApp oficial
- Substituir o descarte atual de `msg.type === "reaction"` no webhook da Meta pelo mesmo fluxo de gravação, troca e remoção.
- Manter cada integração isolada por conta, conversa e mensagem.

### 4. Corrigir o envio pelo ROY
- Passar a conexão exata da conversa ao comando de reação, evitando escolher outra conexão quando um setor possui mais de uma.
- Incluir `send_reaction` nas mesmas validações de setor dos demais envios.
- Validar e tratar os erros ao espelhar a reação no banco; em falha, desfazer o emoji otimista e mostrar o erro real ao usuário.
- Manter o endpoint confirmado da UAZAPI (`/message/react`, com número, ID e emoji; texto vazio remove).

### 5. Garantir atualização visual
- Preservar a atualização em tempo real já configurada.
- Fazer o estado otimista permanecer até a confirmação, sem ser apagado por uma leitura vazia prematura.
- Confirmar que adicionar, trocar e remover reação atualiza o chip, a contagem e o destaque de “Você” sem recarregar a conversa.

## Validação

- Reproduzir com uma mensagem recebida e uma enviada.
- Testar reação criada pelo WhatsApp, troca de emoji e remoção.
- Testar reação criada pelo ROY e confirmar que aparece também no WhatsApp.
- Conferir no banco que cada operação cria, atualiza ou remove exatamente uma linha vinculada à mensagem correta.
- Validar em uma conversa de setor com conexão específica e revisar os registros dos dois webhooks sem expor conteúdo sensível.
