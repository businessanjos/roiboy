# Sugestões de resposta sob demanda no RoyZapp (Comercial)

## Problema

Hoje as sugestões aparecem sozinhas e só quando a última mensagem é do cliente. Se o vendedor fecha no X, ou se ele responde (por exemplo, manda um "bom dia"), a caixa some e não existe nenhum jeito de trazê-la de volta.

## O que muda

1. **Botão fixo na barra de digitação**
   - Um botão de varinha/estrela ao lado dos outros ícones do campo de mensagem, visível para o Comercial.
   - Clicar gera sugestões na hora com base nas últimas mensagens da conversa, mesmo que a última mensagem tenha sido do próprio vendedor.
   - Clicar de novo com a caixa aberta fecha a caixa (liga/desliga).
   - Enquanto gera, o botão mostra estado de carregando.

2. **Fechar no X não é mais definitivo**
   - O X apenas recolhe a caixa. O botão continua lá para reabrir quando quiser.
   - As últimas sugestões geradas ficam guardadas na conversa aberta, então reabrir mostra o que já existia sem gastar uma nova geração; o botão de atualizar gera novas.

3. **Comportamento automático preservado**
   - Quando o cliente manda uma mensagem nova, as sugestões continuam aparecendo sozinhas, como hoje — a menos que o vendedor tenha fechado a caixa nessa conversa.
   - Trocar de conversa limpa tudo e volta ao normal.

## Detalhes técnicos

- `useMessageAssistant.tsx`: separar `dismissed` (recolhido) de `suggestions` (mantidas em memória); expor `openSuggestions()` / `toggleSuggestions()` que chama `fetchSuggestions(true, { manual: true })`; no modo manual, não exigir que a última mensagem seja do cliente nem comparar assinatura; `dismissSuggestions` passa a só marcar recolhido, sem limpar a lista. Novo retorno: `suggestionsOpen`, `toggleSuggestions`.
- `supabase/functions/suggest-replies/index.ts`: aceitar `manual: boolean` no corpo; quando `manual` for verdadeiro, pular a checagem "última mensagem precisa ser do cliente" e instruir o prompt a propor a próxima mensagem do consultor para retomar/avançar a conversa. Continua restrito ao setor `vendas`.
- `ZappMessageInput.tsx`: novo botão opcional (props `onToggleSuggestions`, `suggestionsOpen`, `isLoadingSuggestions`, `showSuggestionsButton`) na fileira de ações, com ícone `Sparkles` e `title="Sugestões de resposta"`, usando tokens de cor existentes.
- `ZappChatView.tsx`: ligar o novo retorno do hook ao `ZappMessageInput` e passar `suggestionsOpen` para o `ZappAIAssistBar`.
- `ZappAIAssistBar.tsx`: exibir a seção de sugestões conforme `suggestionsOpen`; X apenas recolhe.

## Validação

- Abrir uma conversa do Comercial, responder uma mensagem e clicar no botão: sugestões devem ser geradas mesmo sem mensagem nova do cliente.
- Fechar no X e reabrir pelo botão: as sugestões anteriores voltam sem nova geração; o botão de atualizar gera novas.
- Trocar de conversa e conferir que o estado zera.
- Conferir que em CS e Financeiro o botão não aparece.
- Sem erros no console e build limpo.
