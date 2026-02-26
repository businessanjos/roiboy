

## Remover "Funil de Vendas" do painel Conversas/WhatsApp

### Alteracoes

**Arquivo:** `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`

1. Remover o import de `SalesFunnelChart`
2. Remover o import de `Filter` (usado apenas no icone da secao "Funil e Tempo")
3. Remover o state `hiddenFunnelStages` (usado apenas pelo SalesFunnelChart)
4. Na secao "Funil e Tempo", remover o grid 60/40 e o `SalesFunnelChart`, mantendo apenas o `TimePerStageCard` em largura total
5. Renomear a secao de "Funil e Tempo" para "Tempo por Etapa" ja que o funil foi removido

A secao ficara assim:

```text
<CollapsibleSection title="Tempo por Etapa" subtitle="Analise de velocidade e eficiencia" icon={<Clock .../>}>
  <TimePerStageCard ... />
</CollapsibleSection>
```

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx` | Remover SalesFunnelChart e simplificar secao |

