

## Corrigir encolhimento repentino dos visuais no Modo Foco

### Causa raiz identificada

**Duas grids renderizadas ao mesmo tempo:** Quando o Modo Foco esta ativo, a grid normal (por tras do overlay) continua montada e escutando eventos de `window.resize`. Ao entrar em tela cheia, o resize dispara `handleLayoutChange` na grid oculta, que **salva novas posicoes no banco de dados** baseadas no container escondido/comprimido. Os visuais atualizam via prop e a grid do Modo Foco re-renderiza com posicoes corrompidas.

**CSS zoom afeta a medicao de largura:** Dentro do container com `zoom`, o `offsetWidth` retorna um valor reduzido. Quando o resize acontece, a grid mede uma largura menor, recalcula as posicoes dos itens, e os visuais encolhem.

### Solucao (2 arquivos)

**Arquivo 1: `src/components/insights/InsightsMainContent.tsx`**

- Quando `isFocusMode` esta ativo, NAO renderizar a `InsightsGrid` normal. Substituir por `null` ou simplesmente ocultar com condicionais. Isso impede que a grid oculta dispare saves de layout durante fullscreen/resize.

```text
// ANTES (ambas as grids montadas):
{focusModeOverlay}
...
<InsightsGrid visuals={visuals} onLayoutChange={handleLayoutChange} />

// DEPOIS (grid normal desabilitada durante foco):
{focusModeOverlay}
...
{!isFocusMode && <InsightsGrid visuals={visuals} onLayoutChange={handleLayoutChange} />}
```

**Arquivo 2: `src/components/insights/grid/InsightsGrid.tsx`**

- Ao medir a largura do container, compensar o zoom do ancestral. Usar `getBoundingClientRect().width` (que retorna tamanho visual pos-zoom) e dividir pelo ratio de zoom detectado:

```text
const updateWidth = () => {
  if (containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    const offsetW = containerRef.current.offsetWidth;
    // Se zoom estiver aplicado, rect.width != offsetWidth
    // Usar offsetWidth que e o valor correto para layout CSS dentro do zoom
    setWidth(offsetW);
  }
};
```

- Isso ja e o comportamento atual, mas para garantir estabilidade, adicionar um check: em modo `readOnly`, medir largura apenas uma vez no mount e ao entrar/sair de fullscreen (via `fullscreenchange` event), evitando re-medicoes por outros resize events que possam causar instabilidade:

```text
useEffect(() => {
  const updateWidth = () => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
  };
  updateWidth();
  
  if (readOnly) {
    // Em readOnly, apenas re-medir ao mudar fullscreen (nao em qualquer resize)
    document.addEventListener("fullscreenchange", updateWidth);
    return () => document.removeEventListener("fullscreenchange", updateWidth);
  } else {
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }
}, [readOnly]);
```

### Resumo das mudancas

| Arquivo | Mudanca | Impacto |
|---------|---------|---------|
| `InsightsMainContent.tsx` | Nao renderizar grid normal quando Modo Foco ativo | Impede saves de layout corrompidos |
| `InsightsGrid.tsx` | Em modo readOnly, re-medir largura apenas no fullscreenchange | Estabiliza dimensoes durante zoom |

