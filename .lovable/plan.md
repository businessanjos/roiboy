

## Plano: Exibir tempo em horas quando < 1 dia

### Problema
Atualmente `avgDays` é arredondado com `Math.round()` no hook, perdendo a precisão para tempos menores que 24h (aparecem como "0 dias").

### Alterações

**1. `src/hooks/useWhatsAppDashboardData.ts`**
- Remover `Math.round(avgDays)` nas linhas 417 e 431 — passar o valor float bruto
- Também ajustar `totalCycleDays` (linha 435) para manter precisão

**2. `src/components/insights/whatsapp-dashboard/TimePerStageCard.tsx`**
- Criar função helper `formatDuration(days: number)`:
  - Se `days < 1`: exibir em horas → `Math.round(days * 24) + "h"` (ex: "5h", "18h")
  - Se `days >= 1`: exibir em dias → `Math.round(days) + " dias"` (ex: "2 dias")
- Aplicar nos transitions e no Ciclo Total de Vendas

### Arquivos afetados
- `src/hooks/useWhatsAppDashboardData.ts` — passar valores float
- `src/components/insights/whatsapp-dashboard/TimePerStageCard.tsx` — formatação condicional

