

## Ajuste nos Visuais de Funil — Porcentagens nas Laterais

### O que muda

Atualmente a porcentagem de conversão entre etapas aparece **dentro da barra, à direita do valor**. O ajuste move as porcentagens para **fora da barra**, nas laterais:

- **Esquerda da barra**: Conversão entre etapas (% de leads da etapa anterior que passaram para esta). "Chegou Lead" = 100%.
- **Direita da barra**: Conversão geral (% desta etapa em relação ao topo do funil).

Layout por linha:
```text
[100%]  ████████ Chegou Lead          786 ████████  [100%]
 [90%]  ██████ Contato Realizado      708 ██████    [90%]
 [53%]  ████ Em Qualificação          375 ████      [48%]
```

### Arquivos alterados

1. **`src/components/insights/visuals/ConfigurableFunnel.tsx`** — Funil do Insights customizável
   - Envolver cada barra em `flex` row com labels à esquerda e direita
   - Esquerda: `conversionFromPrev` (etapa anterior → atual). Index 0 = 100%
   - Direita: `cumValue / maxValue * 100` (conversão geral vs topo)
   - Remover o badge de % que estava dentro da barra
   - Aplicar o mesmo padrão para "Ganhos"

2. **`src/components/insights/whatsapp-dashboard/SalesFunnelChart.tsx`** — Funil do painel WhatsApp
   - Mesmo layout: labels fora da barra nas laterais
   - Esquerda: `conversionFromPrev`. Index 0 = 100%
   - Direita: `cumulativeCount / maxCumulative * 100` (geral)
   - Remover badge interno de %

