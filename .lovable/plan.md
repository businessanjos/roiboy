

## Corrigir adaptacao do grid ao zoom no modo foco

### Problema

O `InsightsGrid` mede a largura do seu container via `offsetWidth` e escuta apenas `window.resize` para recalcular. Quando o zoom CSS muda no modo foco, nenhum evento de resize e disparado, entao o grid mantem a largura original e nao se adapta ao novo nivel de zoom.

### Solucao

Substituir o listener de `window.resize` no `InsightsGrid` por um `ResizeObserver` no container. O `ResizeObserver` detecta mudancas de tamanho do container independentemente da causa (resize da janela, zoom CSS, fullscreen, etc.), tornando o grid responsivo a todas essas situacoes.

### Alteracao

**Arquivo:** `src/components/insights/grid/InsightsGrid.tsx`

**Linhas 100-117**: Substituir o `useEffect` atual que usa `window.addEventListener("resize")` e `document.addEventListener("fullscreenchange")` por um unico `ResizeObserver` no `containerRef`:

```text
useEffect(() => {
  if (!containerRef.current) return;
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      setWidth(entry.contentRect.width);
    }
  });
  ro.observe(containerRef.current);
  return () => ro.disconnect();
}, []);
```

Isso elimina a necessidade de tratar `readOnly` separadamente e garante que o grid recalcule sua largura automaticamente quando o zoom muda, quando entra em fullscreen, ou quando a janela e redimensionada.
