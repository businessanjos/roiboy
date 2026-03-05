

## Plano: Remover seção "Taxas de Conversão"

Remover completamente a seção de Taxas de Conversão do dashboard e todo o código associado que só existia para alimentá-la.

### Alterações em `WhatsAppDashboardPanel.tsx`

1. **Remover a seção `conversion`** (linhas 189-204) do JSX
2. **Remover `'conversion'` do tipo `SectionId`** (linha 24)
3. **Remover toda a lógica de cálculo de conversão** (linhas 121-151): `funnelStages`, `isGanhos`, `regularFunnelStages`, `ganhosItem`, `ganhosValue`, `funnelCumulative`, `stageConversions`, `funnelTotal`, `funnelOverallConversion`
4. **Remover o hook `useVisualData`** e imports associados (`AggregatedDataPoint`, `VisualConfig`) já que só eram usados para a conversão
5. **Remover o import de `ConversionScoreCards`**

Nenhum outro arquivo precisa ser alterado — o componente `ConversionScoreCards.tsx` pode permanecer no projeto caso venha a ser útil futuramente.

