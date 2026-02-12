

## Corrigir scorecard que expande ao recarregar a pagina

### Causa raiz

A funcao `visualToLayoutItem` no `InsightsGrid.tsx` tem uma heuristica para detectar layouts salvos na escala antiga (12 colunas) e converter para a escala nova (48 colunas):

```
const isOldScale = existingLayout.x <= 12 && existingLayout.w <= 12;
```

O layout desse scorecard esta salvo no banco como `{w:8, h:12, x:0, y:0}` -- valores corretos na escala de 48 colunas. Porem, como `x=0` e `w=8` sao ambos menores que 12, a heuristica interpreta erroneamente como escala antiga e multiplica os valores (w=32, h=60), fazendo o card expandir toda vez que a pagina e carregada.

**Esse bug afeta qualquer visual pequeno posicionado no canto esquerdo da tela.**

### Solucao

Salvar um campo `scale: 48` no objeto de layout ao persistir, e usar esse campo para decidir se a migracao de escala e necessaria:

1. **`src/components/insights/grid/InsightsGrid.tsx`**:
   - Na funcao `visualToLayoutItem`: verificar se `existingLayout.scale === 48`. Se sim, usar os valores diretamente (sem conversao). Se nao tiver o campo `scale`, aplicar a migracao antiga
   - No `handleUserLayoutChange`: incluir `scale: 48` no objeto de layout salvo no banco

2. **`src/hooks/useInsightsDashboards.tsx`**:
   - Atualizar o tipo `InsightsVisual.layout` para incluir o campo opcional `scale`

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/insights/grid/InsightsGrid.tsx` | Adicionar `scale: 48` ao layout persistido; usar `scale` em vez da heuristica de `x <= 12 && w <= 12` |
| `src/hooks/useInsightsDashboards.tsx` | Atualizar tipo de `layout` para incluir `scale?: number` |

### O que muda para o usuario

- Scorecards e outros visuais pequenos permanecerao no tamanho definido ao sair e voltar ao painel
- Layouts antigos (sem campo `scale`) continuarao sendo migrados corretamente
- Novos salvamentos incluirao o marcador `scale: 48` para evitar o problema no futuro

