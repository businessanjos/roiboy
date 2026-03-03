
## Alinhar barras do funil ao centro

### Problema
As barras estão desalinhadas porque o `width: widthPct%` está aplicado ao **row inteiro** (que inclui labels), e `items-center` no container centra o row. Como os labels têm largura fixa mas o row muda de tamanho, o centro visual das barras coloridas não coincide perfeitamente entre etapas.

### Solução
Fazer cada row ocupar 100% da largura e centralizar a barra colorida dentro dele. A barra terá `width: widthPct%` e `mx-auto` (ou `justify-center` no row). Os labels de porcentagem ficam posicionados com largura absoluta fora da barra.

Layout proposto:
```text
|<================ 100% row =================>|
         [%] ██████ bar (80%) ██████ [%]
           [%] ████ bar (60%) ████ [%]
              [%] ██ bar (40%) ██ [%]
```

Cada row terá `w-full flex justify-center items-center`. Dentro, um sub-container com `width: widthPct%` contendo `[label] [bar flex-1] [label]`. Isso garante que o ponto central de cada barra esteja sempre no mesmo eixo vertical.

### Arquivos
1. **`ConfigurableFunnel.tsx`** — Remover width do row, mover para sub-container centralizado
2. **`SalesFunnelChart.tsx`** — Mesma correção
