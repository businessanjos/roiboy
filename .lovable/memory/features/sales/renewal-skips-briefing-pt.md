---
name: Renovação dispensa Briefing Operacional
description: Negócios de renovação (flag deals.is_renewal ou produto com products.is_renewal) não exigem o Briefing para Operação ao marcar como ganho
type: feature
---
O Briefing para Operação (que alimenta o CS) NÃO é exigido quando o negócio é uma renovação.

- Coluna `deals.is_renewal` (boolean, default false) — marcada manualmente por um switch "É uma renovação" na coluna de detalhes do `DealDetailSheet`.
- Detecção automática: se o produto do campo "Item da Venda" tiver `products.is_renewal = true`, também dispensa.
- `handleMarkAsWon` em `SalesPipeline.tsx` só bloqueia por briefing quando não é renovação; a prop `skipBriefing` do `RequiredFieldsModal` oculta a aba do briefing nesses casos.
