# Impedir reações de virarem mensagens no RoyZapp

A imagem mostra um segundo caminho independente do webhook: a sincronização automática do histórico do WhatsApp importou reações como mensagens comuns. Nas últimas três horas, 29 dos 33 balões suspeitos vieram desse sincronizador, incluindo `[reação]` e emojis isolados. Ao mesmo tempo, a tabela correta de reações permaneceu vazia.

## Correções

### 1. Bloquear reações no importador de histórico
- Identificar reação pelo tipo e pelas estruturas aninhadas retornadas pela UAZAPI antes de montar uma mensagem comum.
- Reação nunca poderá entrar em `zapp_messages`, mesmo quando estiver incompleta ou sem emoji.
- Remover o fallback atual que transforma reação vazia em `[reação]`.

### 2. Importar no formato correto
- Extrair separadamente o ID da reação, o ID da mensagem alvo, o emoji, o autor e o sentido.
- Localizar a mensagem alvo somente dentro da mesma conta e conversa, com igualdade exata e fallback controlado por sufixo.
- Criar, trocar ou remover a linha em `zapp_message_reactions`; se o alvo ainda não existir, manter uma reação pendente para reconciliação.
- Compartilhar a mesma normalização entre sincronização histórica e webhook para os dois caminhos não voltarem a divergir.

### 3. Reparar os balões já criados
- Reconsultar no provedor apenas a janela afetada e classificar cada item pela estrutura original.
- Excluir de `zapp_messages` somente os registros confirmados como reação pelo provedor, sem apagar mensagens legítimas que contenham apenas emoji.
- Recriar essas reações na tabela correta quando a mensagem alvo puder ser encontrada.
- Recalcular a prévia e a data da última mensagem das conversas afetadas para que `[reação]` não permaneça na lista.

### 4. Garantir que o problema não volte
- Adicionar testes para reação adicionada, trocada e removida, inclusive reação vazia e estruturas aninhadas.
- Validar que uma sincronização repetida seja idempotente: nenhuma reação duplicada e nenhum novo balão.
- Conferir no RoyZapp uma conversa individual e um grupo, tanto pelo recebimento ao vivo quanto pela sincronização automática.

## Resultado esperado

Reações aparecem somente como pequenos emojis vinculados ao balão original. `[reação]` e emojis de reação nunca mais surgem como mensagens separadas, e a limpeza preserva emojis enviados intencionalmente como mensagem.
