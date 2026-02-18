

## Eliminar espaco em branco no Modo Foco (Fullscreen)

### Problema

No Modo Foco / tela cheia, os visuais do grid ocupam apenas a area necessaria baseada em suas posicoes fixas (grid de 48 colunas com rowHeight de 20px). O espaco restante do viewport fica vazio com o fundo da pagina, criando uma aparencia incompleta -- especialmente visivel em TVs via Chromecast.

### Solucao: Auto-fit do zoom ao conteudo

Implementar um calculo automatico de zoom que faz o conteudo preencher toda a altura disponivel do viewport. O sistema vai:

1. Medir a altura real do conteudo (filtros + grid) apos a renderizacao
2. Comparar com a altura disponivel do viewport (descontando o header do modo foco)
3. Calcular o zoom ideal para que o conteudo preencha a tela sem scroll
4. Aplicar esse zoom automaticamente ao entrar no modo foco
5. Permitir que o usuario ainda ajuste manualmente via controles de zoom

Se o conteudo for maior que a tela (zoom ficaria < 50%), manter o zoom em 50% e permitir scroll.

### Mudancas tecnicas

**Arquivo: `src/components/insights/InsightsMainContent.tsx`**

| Mudanca | Descricao |
|---------|-----------|
| Novo ref `contentRef` | Ref para o div que contem filtros + grid (o div com `zoom`) |
| Novo `useEffect` de auto-fit | Ao entrar no modo foco (`isFocusMode === true`), medir `contentRef.scrollHeight` e `window.innerHeight`, calcular zoom ideal e aplicar via `setFocusZoom` |
| Logica de calculo | `autoZoom = Math.floor((viewportAvailable / contentNaturalHeight) * 100)`, clamped entre 50 e 200 |
| Medir com zoom=100 primeiro | Temporariamente renderizar com zoom 100% para obter a altura natural, depois aplicar o zoom calculado |

A logica em pseudocodigo:

```
ao entrar no modo foco:
  1. renderizar conteudo com zoom = 100%
  2. apos o layout (requestAnimationFrame):
     - headerHeight = altura do header do modo foco (~72px)
     - padding = 48px (p-6 top + bottom)
     - availableHeight = window.innerHeight - headerHeight - padding
     - contentHeight = contentRef.scrollHeight
     - idealZoom = (availableHeight / contentHeight) * 100
     - setFocusZoom(clamp(idealZoom, 50, 200))
```

**Arquivo: `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`**

Aplicar a mesma logica de auto-fit para manter consistencia entre os dois tipos de dashboard no modo foco.

### Resultado esperado

- Ao abrir o modo foco, os visuais preenchem automaticamente toda a tela disponivel
- Sem espaco em branco visivel abaixo dos visuais
- O usuario ainda pode ajustar o zoom manualmente se preferir
- O calculo se adapta a diferentes resolucoes de tela e quantidades de visuais

