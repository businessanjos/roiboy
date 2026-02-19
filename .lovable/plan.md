

## Corrigir visuais invisiveis no painel compartilhado

### Causa raiz

O `useEffect` que configura o `ResizeObserver` tem dependencias vazias (`[]`). Ele executa apenas uma vez, no mount do componente, quando o `state` e "loading". Nesse momento, o componente faz `return` antecipado (tela de loading), entao o `div` com `containerRef` nao existe no DOM. Quando o estado muda para "approved" e o div aparece, o efeito nao re-executa, logo `gridWidth` permanece `0` e a condicao `gridWidth > 0` nunca e satisfeita -- os visuais ficam invisiveis.

### Solucao

Adicionar `state` na lista de dependencias do `useEffect` do `ResizeObserver`. Assim, quando o estado mudar para "approved", o efeito re-executa, encontra o `containerRef.current`, configura o observer e captura a largura correta.

### Alteracao

**Arquivo: `src/pages/SharedInsightsDashboard.tsx`**

Mudar a linha 75 de:
```
  }, []);
```
Para:
```
  }, [state]);
```

Essa unica alteracao garante que o observer e criado assim que a view "approved" renderiza o container div, capturando a largura real e permitindo que o grid e os visuais sejam exibidos.

