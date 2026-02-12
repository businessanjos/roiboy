

## Corrigir redimensionamento de visuais no grid do Insights

### Problema identificado

Dois problemas estao causando o snap-back ao redimensionar:

1. **Sincronizacao de layout**: O componente usa `onResizeStop` para atualizar o `localLayout`, mas o `react-grid-layout` v2 precisa que o `layout` prop esteja sincronizado durante toda a interacao (nao apenas no final). Sem usar `onLayoutChange` para manter o estado sincronizado continuamente, o RGL reverte para o valor do prop `layout` antigo no proximo render.

2. **Altura minima no Card**: O `ConfigurableVisualCard` tem `min-h-[250px]` no Card, que conflita com alturas menores definidas pelo grid (ex: `h:12 * rowHeight:20 = 240px`).

### Solucao

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/grid/InsightsGrid.tsx` | Adicionar `onLayoutChange` para manter `localLayout` sincronizado continuamente durante drag/resize. Manter `onDragStop`/`onResizeStop` apenas para persistir no banco. |
| `src/components/insights/visuals/ConfigurableVisualCard.tsx` | Remover `min-h-[250px]` do Card principal e do CardContent, substituindo por dimensoes flexiveis que respeitem o tamanho do grid |

### Detalhes tecnicos

**InsightsGrid.tsx:**
- Adicionar handler `onLayoutChange` que atualiza `localLayout` a cada mudanca (isso mantem o prop `layout` sincronizado com o estado interno do RGL, evitando o snap-back)
- Manter `onDragStop`/`onResizeStop` exclusivamente para disparar a persistencia no banco de dados
- Usar um ref para rastrear o layout mais recente e evitar atualizacoes desnecessarias

**ConfigurableVisualCard.tsx:**
- Trocar `min-h-[250px]` por `h-full` para que o card preencha o espaco do grid sem forcar um tamanho minimo
- Remover `min-h-[200px]` do CardContent, usando `flex-1` que ja esta presente
- Nos estados de loading e erro, tambem remover alturas fixas

