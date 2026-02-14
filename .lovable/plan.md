

## Corrigir bug: etapas ocultas do funil reaparecem no Modo Foco

### Causa raiz
O componente `SalesFunnelChart` armazena as etapas ocultas (`hiddenStages`) em um `useState` interno. Quando o Modo Foco e ativado, o `dashboardContent` e renderizado **duas vezes**: na view normal e no portal. O portal cria uma **nova instancia** do `SalesFunnelChart` com `hiddenStages` vazio, fazendo todas as etapas reaparecerem.

### Solucao
Elevar o estado `hiddenStages` para o componente pai (`WhatsAppDashboardPanel`) e passa-lo como props para o `SalesFunnelChart`. Assim, ambas as instancias (normal e foco) compartilham o mesmo estado.

### Mudancas

**1. `SalesFunnelChart.tsx`**
- Adicionar props opcionais `hiddenStages` e `onHiddenStagesChange` na interface
- Usar o estado externo quando fornecido, mantendo fallback para estado interno (retrocompatibilidade)

**2. `WhatsAppDashboardPanel.tsx`**
- Criar `useState<Set<string>>` para `hiddenStages` no nivel do painel
- Passar `hiddenStages` e `onHiddenStagesChange` para o `SalesFunnelChart` no `dashboardContent`

### Resultado
Ao desmarcar "No Show" na view normal, o Modo Foco tambem respeita a selecao, pois ambas as renderizacoes compartilham o mesmo estado.

