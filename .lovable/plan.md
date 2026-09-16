# Discador 3C: trazer de volta o popup dentro do chat e torná-lo flutuante

## O que eu verifiquei de fato

Abri o ROY autenticado como o seu usuário, entrei no RoyZapp e conferi a tela: **nenhum botão ou popup do discador 3C aparece**. O quadro do discador existe na página, mas fica totalmente escondido.

## Os erros encontrados (confirmados)

1. **O discador só aparece para quem tem ramal cadastrado.**
   O painel só se mostra quando o usuário tem ramal 3C gravado no seu cadastro. Hoje só 4 pessoas têm ramal (Maikol, Everton, Darlan, Jonathan) e um usuário tem só o código de agente, sem ramal. O seu usuário não tem nenhum dos dois, então o discador some por completo — sem aviso, sem botão, sem explicação. Foi exatamente isso que fez o popup "sumir".

2. **Não existe popup dentro do chat.** O que existe hoje é uma gaveta que entra pela lateral direita ocupando a tela inteira de altura. Não nasce embaixo, não é flutuante e não pode ser movida — só redimensionada pela borda esquerda.

3. **O botão de ligar do chat não abre o discador em caso de sucesso.** Ao ligar pelo cabeçalho da conversa, o painel só é aberto quando a ligação **falha** (agente offline, em pausa etc.). Quando a discagem dá certo, aparece apenas um aviso "Discando…" e o usuário fica sem tela para atender/qualificar.

4. **Ao ocultar o discador, o botão de reabrir some junto em algumas situações.** A abinha lateral de reabrir só é desenhada quando não há chamada em andamento e depende do mesmo bloqueio do item 1.

5. **O discador só é montado em Vendas e no RoyZapp.** Fora dessas áreas ele não existe, mesmo que a pessoa esteja ligando.

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

### 4. Reabrir sempre possível
- Garantir que exista sempre um ponto de reabertura visível (abinha lateral ou botão flutuante), inclusive durante chamada e depois de fechar no X.

## Detalhes técnicos

- `src/components/threecplus/ThreeCPlusPanel.tsx`: trocar `aside` fixo à direita por container flutuante posicionado por `left/top`, drag via pointer events na barra de título, clamp no viewport, persistência em `localStorage` (posição + tamanho); revisar a condição `hasExtension` para `canUseDialer` (integração da conta OU ramal), com estado "sem ramal".
- `supabase/functions/threecplus-agent` (`get_extension`): retornar também se a conta tem integração 3C ativa, para alimentar `canUseDialer`. Somente leitura, sem expor tokens.
- `src/components/royzapp/ZappChatView.tsx` (`handleCall`): disparar `threecplus:open-drawer` com `contact_name`/`phone` também no caminho de sucesso.
- `src/components/layout/AppLayout.tsx`: manter `showThreeCPlus` para Vendas e `/roy-zapp` (sem mudança de escopo agora).
- Validação: rodar o navegador autenticado em `/roy-zapp`, confirmar botão visível, abrir o popup, arrastar e conferir persistência da posição; conferir build limpo.
