# Discador 3C: clicável, com rolagem e chamada que não cai ao fechar

## O que está errado hoje

O painel exibe a tela da 3C "encolhida" por um efeito de zoom. Esse encolhimento é a causa dos três problemas:

- os cliques caem no lugar errado (o que se vê não coincide com a área real do botão);
- a rolagem não funciona, porque a área do quadro é travada na altura;
- partes da tela continuam cortadas na direita.

Além disso, ao fechar no X o painel vira apenas uma abinha sem informação: não dá para saber se há chamada em andamento nem há cronômetro.

## O que vai mudar

1. **Fim do zoom.** A tela da 3C passa a ocupar o painel inteiro, no tamanho real, sem encolher. Clique e rolagem voltam a funcionar exatamente como na 3C aberta direto no navegador.
2. **Painel largo por padrão**, com a alça de arrastar na borda esquerda mantida e a largura guardada, e um botão "tela cheia" para ocupar toda a janela quando precisar.
3. **A ligação nunca cai.** A tela da 3C fica sempre carregada em segundo plano: fechar no X, navegar entre telas ou trocar de página apenas esconde o painel, o áudio continua e a chamada segue viva.
4. **Cartão flutuante funcional ao fechar.** Fechando durante uma chamada, aparece um cartão no canto com: nome/telefone do contato quando conhecido, indicador "Em chamada" pulsando, **cronômetro da duração**, botão para reabrir o painel e botão para minimizar em abinha. Sem chamada, volta a ser o botão simples "Discador 3C" com o status.
5. **Cronômetro também dentro do painel**, no cabeçalho, junto do status.
6. **Estado em tempo quase real.** Enquanto houver chamada, o estado é consultado a cada 5 segundos (em vez de 30), para o cronômetro iniciar assim que a ligação é atendida e parar assim que encerra.
7. **Fundo escurecido só quando o painel está em tela cheia.** Na largura normal o painel deixa de bloquear a tela atrás: dá para continuar lendo a ficha do negócio e rolar a página enquanto fala.

## Detalhes técnicos

Arquivo: `src/components/threecplus/ThreeCPlusPanel.tsx`

- Remover `scale`, `MIN_SCALE`, `BASE_WIDTH`, o `ResizeObserver` de escala e o wrapper com largura calculada. O iframe passa a `className="h-full w-full border-0"` dentro de um contêiner `min-h-0 flex-1`.
- Manter o iframe **sempre montado** a partir do primeiro carregamento (`mountedOnce` ref): o `aside` continua no DOM com `translate-x-full`/`opacity-0`/`pointer-events-none` quando fechado — nunca desmontar nem alterar `src`.
- Remover o bloqueio de `document.body.style.overflow` no modo normal; aplicar só quando `fullscreen`.
- Backdrop renderizado apenas em `fullscreen`.
- Novo estado `fullscreen` (botão Maximize no cabeçalho): `aside` com `w-screen` e `inset-0`.
- Cronômetro: `callStartedAt` ref setado quando `status` passa para `on_call` e limpo ao sair; `useEffect` com `setInterval(1000)` atualizando `elapsed` formatado `mm:ss` (ou `h:mm:ss`). Exibido no cabeçalho e no cartão flutuante.
- Polling adaptativo: intervalo de `refreshStatus` passa a `status === "on_call" ? 5_000 : 30_000`.
- Cartão flutuante em chamada: substitui o botão atual quando `!isOpen && status === "on_call"` — borda `border-destructive/40`, ponto pulsando, cronômetro, botão "Abrir" e botão de minimizar para a abinha lateral existente.
- Contato em chamada: ouvir o evento já existente `threecplus:dial-request` / `threecplus:open-drawer` e guardar `contact_name`/`phone` do detalhe quando vier, para mostrar no cartão.

Sem mudanças em regras de negócio, registro em `threecplus_call_logs` ou integração com a 3C.
