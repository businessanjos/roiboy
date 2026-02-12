

## Corrigir cards que expandem/reduzem sozinhos apos redimensionar

### Causa raiz

O problema e um **ciclo de feedback** entre o grid e o banco de dados:

1. Usuario redimensiona o card -- `onLayoutChange` dispara com debounce de 500ms
2. O `updateVisual` salva no banco e, ao ter sucesso, chama `queryClient.invalidateQueries` (linha 278 de `useInsightsDashboards.tsx`)
3. Isso forca um refetch dos visuais do banco de dados
4. O `layout` do `InsightsGrid` e recalculado via `useMemo` a partir dos novos `visuals` (que podem ainda conter o layout antigo se o debounce nao completou, ou se o refetch foi mais rapido que o save)
5. O card "pula" de volta para o tamanho anterior

Alem disso, o `onLayoutChange` do `react-grid-layout` dispara tambem na montagem inicial e quando o layout muda externamente, criando mais ciclos de atualizacao desnecessarias.

### Solucao

**Arquivo: `src/components/insights/grid/InsightsGrid.tsx`**

1. **Gerenciar layout localmente**: manter um estado `localLayout` interno que so e sincronizado com os props na montagem inicial ou quando os visuais mudam de fato (novos visuais adicionados/removidos), nao quando o layout de um visual existente muda
2. **Ignorar `onLayoutChange` na montagem**: usar uma flag `isUserInteracting` para distinguir entre mudancas feitas pelo usuario (drag/resize) e mudancas internas do grid (re-render, montagem)
3. **Usar callbacks de drag/resize stop**: usar `onDragStop` e `onResizeStop` em vez de `onLayoutChange` para capturar apenas as alteracoes intencionais do usuario

**Arquivo: `src/hooks/useInsightsDashboards.tsx`**

4. **Nao invalidar query em updates de layout**: quando o `updateVisual` recebe apenas `layout`, nao chamar `invalidateQueries` -- usar update otimista no cache local para evitar o refetch que causa o "snap back"

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/grid/InsightsGrid.tsx` | Substituir `onLayoutChange` por `onDragStop`/`onResizeStop`; manter estado local do layout para evitar resets externos |
| `src/hooks/useInsightsDashboards.tsx` | Usar update otimista do cache (setQueryData) em vez de invalidateQueries para updates de layout |

### O que muda para o usuario

- Ao redimensionar ou mover um card, ele permanece exatamente no tamanho/posicao definido
- Sem "pulos" ou expansoes inesperadas
- O salvamento continua funcionando com debounce de 500ms

