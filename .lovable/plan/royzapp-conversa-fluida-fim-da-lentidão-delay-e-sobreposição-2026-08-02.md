# RoyZapp: conversa fluida (fim da lentidão, delay e sobreposição)

## Diagnóstico (verificado no código)

Ao abrir uma conversa, o app monta um componente pesado por mensagem. Com 30–130 mensagens carregadas isso vira centenas de componentes interativos invisíveis:

- `ZappMessageBubble` monta **um `AlertDialog` de confirmação de exclusão por mensagem** (linha ~873) e **até 3 `Tooltip` do Radix** por mensagem nos botões de ação. São centenas de contextos/portais montados sem necessidade — é também a origem do warning de `ref` no console (`AlertDialog` recebendo ref em componente função) e da sensação de "coisas sobrepostas".
- A lista usa `ScrollArea` do Radix, que recalcula medidas a cada mudança de conteúdo e substitui o scroll nativo (perde a inércia/momentum do toque no celular) — é o que causa o travamento ao rolar pra cima e pra baixo.
- **Nenhuma virtualização**: todas as mensagens carregadas ficam no DOM, com imagens, áudios e `framer-motion` (`AnimatePresence`) em cada uma.
- **Transcrição automática dispara por áudio montado** (`useEffect` em ~linha 380): abrir uma conversa com vários áudios dispara várias chamadas de edge function ao mesmo tempo, competindo com a renderização.
- Os callbacks (`onReply`, `onDelete`, `onRetry`...) chegam recriados a cada render vindos das camadas acima, anulando o `memo` da bolha — todo render da lista re-renderiza todas as mensagens.
- A deduplicação roda `console.log` e varreduras extras a cada render da lista.

## O que será feito

### 1. Uma bolha leve (maior ganho)
- Remover o `AlertDialog` de dentro da bolha; usar **um único diálogo de confirmação no nível da lista**, acionado por id de mensagem.
- Trocar os `Tooltip` do Radix por `aria-label`/`title` nativos nos botões de ação.
- Remover `AnimatePresence`/`motion` da barra de ações (mostrar/ocultar por CSS `group-hover`), eliminando animação por mensagem.
- No mobile, ações abrem por toque longo/ícone dedicado em vez de hover — sem elementos flutuando sobre o balão.

### 2. Scroll nativo e virtualizado
- Substituir o `ScrollArea` do Radix por um container com scroll nativo (`overflow-y-auto`, `overscroll-contain`, `-webkit-overflow-scrolling: touch`), restaurando a inércia do celular.
- Adicionar virtualização por janela: renderizar apenas as mensagens próximas da viewport, mantendo altura estimada para as demais. Isso preserva a paginação de histórico já existente.
- Simplificar a lógica de ancoragem: com scroll nativo, ancorar no fim ao abrir e no salto de altura ao prepend histórico (sem a janela de "pin" de 1,5s baseada em timer).

### 3. Estabilizar re-renders
- Envolver com `useCallback` os handlers passados de `RoyZapp.tsx` → `ZappChatView` → `ZappMessagesList` → bolha, e passar comparador ao `memo` da bolha.
- Remover `console.log` do caminho de dedupe e reduzir varreduras redundantes (executar dedupe só quando a referência de `messages` mudar de fato).

### 4. Transcrição e mídia sob controle
- Transcrição automática passa a rodar em **fila sequencial** e só para áudios realmente visíveis (via `IntersectionObserver`), com limite de concorrência 1.
- Download de mídia pendente continua em lote, mas só para mensagens visíveis/recentes.

### 5. Validação
- Medir abertura de conversa e rolagem antes/depois com Playwright em viewport mobile (440x807), conferir ausência do warning de ref no console e checar que responder, editar, apagar, citar, buscar, carregar histórico e realtime continuam funcionando.

## Detalhes técnicos

Arquivos afetados: `src/components/royzapp/ZappMessageBubble.tsx`, `ZappMessagesList.tsx`, `ZappChatView.tsx`, `src/pages/RoyZapp.tsx` (memoização de handlers) e ajustes pontuais em `src/hooks/useZappConversations.ts` (fila de mídia). Nenhuma mudança de schema, RLS ou edge function. A virtualização será feita com `@tanstack/react-virtual` (leve, compatível com listas de altura dinâmica) caso já não haja utilitário equivalente no projeto.
