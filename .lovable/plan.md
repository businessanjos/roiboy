

## Corrigir layout comprimido no painel compartilhado

### Problema

O grid do painel compartilhado renderiza todos os visuais em uma coluna estreita (~200px) em vez de ocupar a tela inteira. A causa raiz e a medicao manual de largura usando `offsetWidth` dentro de um `useEffect` com dependencia `[state]`. Quando o estado muda para "approved", a medicao ocorre antes do navegador completar o layout, resultando em um valor de largura incorreto. Alem disso, o `GridLayout` e renderizado no mesmo ciclo, criando um problema de timing.

### Solucao

Substituir a medicao manual de largura (`useEffect` + `offsetWidth`) pelo hook `useContainerWidth` exportado pelo proprio `react-grid-layout`. Este hook usa `ResizeObserver` internamente, que e mais confiavel e reativo. Ele tambem fornece uma flag `mounted` que indica quando a primeira medicao foi feita, permitindo evitar renderizar o grid com largura incorreta.

### Alteracoes

**Arquivo: `src/pages/SharedInsightsDashboard.tsx`**

1. Importar `useContainerWidth` de `react-grid-layout`
2. Remover o `useState` de `gridWidth` e o `useRef` de `containerRef`
3. Remover o `useEffect` de medicao de largura
4. Usar o hook `useContainerWidth`:
   ```
   const { width: gridWidth, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });
   ```
5. Condicionar a renderizacao do `GridLayout` a `mounted` ser `true`:
   ```
   {mounted && <GridLayout width={gridWidth} ... />}
   ```

Essa e a abordagem recomendada pela documentacao do react-grid-layout v2, usa `ResizeObserver` que funciona de forma reativa sem depender de timing de `useEffect`, e garante que o grid so renderize apos a largura real do container ser medida.

### Resultado esperado

O grid do painel compartilhado ocupara toda a largura disponivel da tela, com os visuais posicionados exatamente como no painel original do sistema.
