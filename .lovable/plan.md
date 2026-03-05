

## Plano: Reordenar cards de Taxas de Conversão

### Alteração em `src/components/insights/whatsapp-dashboard/ConversionScoreCards.tsx`

Inverter a ordem de renderização: primeiro as conversões entre etapas (esquerda), depois a Conversão Total (direita/último).

Atualmente: `[Conversão Total] [Etapa1→Etapa2] [Etapa2→Etapa3]`
Resultado: `[Etapa1→Etapa2] [Etapa2→Etapa3] [Conversão Total]`

Basta mover o bloco "Overall Conversion" para depois do `.map()` das conversões de etapa.

