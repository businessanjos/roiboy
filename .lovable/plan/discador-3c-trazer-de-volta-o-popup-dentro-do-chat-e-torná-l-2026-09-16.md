# Discador 3C: trazer de volta o popup dentro do chat e torná-lo flutuante

## O que eu verifiquei de fato

- Abri o ROY autenticado e entrei no RoyZapp: nenhum botão ou popup do discador aparece. O quadro existe na página, porém escondido.
- Conferi os cadastros da 3C: só 5 pessoas têm vínculo e só 4 têm ramal (Maikol, Everton, Darlan, Jonathan). O Darlan tem ramal 1013 e agente 113482.
- Conferi os registros do serviço da 3C agora há pouco: a consulta responde normalmente e o Darlan aparece como agente ativo. Ou seja, no computador dele o problema não é o cadastro: é a própria interface do discador.

## Os erros encontrados (confirmados)

1. **O botão de fechar (X) do discador faz ele "sumir de vez".**
   Ao clicar no X do botão flutuante, o discador some e o único jeito de trazê-lo de volta é uma abinha de 7 pixels de largura, quase transparente (40% de opacidade), colada na borda direita da tela, sem texto. Na prática ninguém acha. É o que aconteceu no computador do Darlan.

2. **Não existe popup dentro do chat.** O que existe hoje é uma gaveta que entra pela lateral direita ocupando toda a altura da tela e, com a largura padrão, cobre a conversa inteira. Não nasce embaixo, não é flutuante e não pode ser movida — só redimensionada por uma borda fina.

3. **Para quem não tem ramal, o discador desaparece sem nenhum aviso.** É o caso do meu teste e de mais usuários da conta: nenhum botão, nenhuma explicação.

4. **O botão de ligar do chat não abre o discador quando a ligação dá certo.** Ao ligar pelo cabeçalho da conversa, o painel só abre quando a ligação **falha**. Dando certo, aparece só o aviso "Discando…" e a pessoa fica sem tela para atender/qualificar.

5. **O discador só existe em Vendas e no RoyZapp.** Fora dessas áreas ele não é montado.


## O que vou fazer

### 1. Voltar a mostrar o discador
- Exibir o discador para quem tem acesso à 3C na conta (não só quem tem ramal).
- Sem ramal configurado, o botão aparece com aviso claro "Ramal não configurado" e um atalho para Configurações > Integrações, em vez de sumir silenciosamente.

### 2. Popup flutuante e movível
- Transformar a gaveta em uma janela flutuante que **nasce embaixo, no canto direito**, sobre o chat.
- Barra de título arrastável para mover livremente pela tela (com limite nas bordas), mantendo a posição e o tamanho guardados entre sessões.
- Manter o redimensionar pelos cantos, o botão de tela cheia, o minimizar e o fechar.
- Fechar continua **não** derrubando a ligação: a chamada segue e o cartão com nome do lead e cronômetro continua visível, com botão "Abrir".

### 3. Abrir a ligação direto do chat
- Ao ligar pelo cabeçalho da conversa no RoyZapp, abrir o popup imediatamente, tanto em sucesso quanto em falha, já com nome e telefone do contato no cronômetro.

### 4. Nunca mais "sumir"
- Trocar a abinha invisível por um botão flutuante sempre legível com o texto "Discador 3C" e o estado do agente.
- Fechar no X passa a apenas recolher o popup para esse botão, nunca esconder o acesso.
- Guardar se o popup ficou aberto ou recolhido, para voltar do mesmo jeito ao trocar de tela ou recarregar.

## Detalhes técnicos

- `src/components/threecplus/ThreeCPlusPanel.tsx`: trocar `aside` fixo à direita por container flutuante posicionado por `left/top`, drag via pointer events na barra de título, clamp no viewport, persistência em `localStorage` (posição + tamanho); revisar a condição `hasExtension` para `canUseDialer` (integração da conta OU ramal), com estado "sem ramal".
- `supabase/functions/threecplus-agent` (`get_extension`): retornar também se a conta tem integração 3C ativa, para alimentar `canUseDialer`. Somente leitura, sem expor tokens.
- `src/components/royzapp/ZappChatView.tsx` (`handleCall`): disparar `threecplus:open-drawer` com `contact_name`/`phone` também no caminho de sucesso.
- `src/components/layout/AppLayout.tsx`: manter `showThreeCPlus` para Vendas e `/roy-zapp` (sem mudança de escopo agora).
- Validação: rodar o navegador autenticado em `/roy-zapp`, confirmar botão visível, abrir o popup, arrastar e conferir persistência da posição; conferir build limpo.
