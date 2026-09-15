# Discador 3C: painel maior, sem corte e sem sobreposição

## O problema

Hoje o discador abre numa faixa estreita na direita e o conteúdo da 3C é encolhido para caber. Com isso:

- a coluna "Qualificação" fica cortada na borda direita, então os itens ficam fora da área clicável;
- os botões ficam minúsculos, difíceis de acertar;
- o painel cobre a ficha do negócio de forma abrupta, dando a sensação de sobreposição/bug;
- ao abrir e fechar, a transição "pula".

## O que vai mudar

1. **Painel maior por padrão.** O discador abre já no tamanho ampliado (cerca de 3/4 da tela em telas grandes), que é a largura mínima em que a tela da 3C aparece inteira, incluindo a coluna de Qualificação. O botão de reduzir/ampliar continua existindo.
2. **Largura ajustável.** Uma alça na borda esquerda do painel permite arrastar para aumentar ou diminuir. A largura escolhida fica guardada e volta igual na próxima abertura.
3. **Nada mais cortado.** O conteúdo passa a ser reduzido só até o ponto em que ainda cabe inteiro na altura e na largura do painel, e a área do quadro acompanha a redução, eliminando o corte lateral.
4. **Zoom mínimo confortável.** Abaixo de uma redução segura, em vez de encolher mais, o painel deixa rolar na horizontal, para os itens nunca ficarem pequenos demais para clicar.
5. **Sobreposição resolvida.** Um fundo escurecido suave aparece atrás do painel quando ele está aberto, com clique fora para fechar, e a entrada/saída ganha animação mais macia (deslizar + esmaecer). Assim fica claro o que está na frente e o que está atrás.
6. **Ficha do negócio respirando.** Com o painel aberto, a ficha atrás não fica presa embaixo do painel de forma estranha: o painel ganha sombra e borda mais definidas e trava a rolagem de fundo enquanto está aberto.

## Detalhes técnicos

Arquivo: `src/components/threecplus/ThreeCPlusPanel.tsx`

- Estado `expanded` inicia `true`; largura controlada por estado `panelWidth` (px) persistido em `localStorage` (`roy_threec_panel_width`), com limites `min 420px` / `max 96vw`.
- Alça de redimensionamento: `div` absoluta na borda esquerda (`w-1.5 cursor-col-resize`), com `pointerdown/pointermove/pointerup` em `window`, atualizando `panelWidth`.
- Cálculo de escala: `scale = clamp(0.6, 1, panelWidth / BASE_WIDTH)`; quando `panelWidth / BASE_WIDTH < 0.6`, o contêiner recebe `overflow-x: auto` em vez de encolher mais.
- O wrapper do iframe recebe `width: BASE_WIDTH * scale` e `height: 100%`, e o iframe mantém `width: BASE_WIDTH`, `height: ${100/scale}%`, `transform: scale(...)` com `transformOrigin: top left` — assim o espaço ocupado bate com o tamanho visual e some o corte.
- Backdrop: `div` `fixed inset-0 z-[55] bg-background/60 backdrop-blur-[2px]` com `transition-opacity`, renderizado apenas quando aberto, `onClick` fecha.
- Transição do `aside`: `transition-[transform,opacity] duration-300 ease-out` e `will-change-transform`; `pointer-events-none` quando fechado.
- Enquanto aberto, aplicar `overflow: hidden` em `document.body` via `useEffect` e restaurar no cleanup.
- Ajustar o `ResizeObserver` existente para ler a largura real do painel (já em uso) e alimentar o novo cálculo.

Nenhuma mudança em regras de negócio, registro de ligações ou integração com a 3C.
