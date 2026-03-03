

## Corrigir formato de funil — barras devem afunilar

### Problema
As barras estão com `flex-1` que as estica para 100% da largura, ignorando o `width` calculado. O funil precisa ser largo no topo e afunilar conforme desce.

### Solução
Nos dois arquivos de funil, remover `flex-1` das barras e usar um container wrapper que ocupa o espaço restante, com a barra dentro dimensionada pela porcentagem cumulativa.

Layout:
```text
[%]  [=================container================]  [%]
     [████████ barra (widthPct%) ████████]
```

### Arquivos

1. **`ConfigurableFunnel.tsx`** — Remover `flex-1` da barra, envolver num `div flex-1` container, a barra dentro usa `width: widthPct%` sem flex-1.

2. **`SalesFunnelChart.tsx`** — Mesmo ajuste.

