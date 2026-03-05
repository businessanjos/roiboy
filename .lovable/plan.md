
## Plano: Alinhar Taxas de Conversão com o Funil de Vendas

### Problema
As **Taxas de Conversão** e o **Funil de Vendas** usam fontes de dados diferentes (`useWhatsAppDashboardData` vs `useVisualData`), gerando discrepâncias nos valores e percentuais. Por exemplo: funnel mostra 87/59/33/4 enquanto cards mostram 84/57/30/2.

### Causa Raiz
São dois hooks separados fazendo queries similares mas não idênticas ao banco de dados. Pequenas diferenças na lógica (ex: joins, paginação) resultam em contagens ligeiramente diferentes.

### Solução
Adicionar uma chamada a `useVisualData` diretamente no `WhatsAppDashboardPanel` com a mesma configuração do funil (`dataSource='deals'`, `dimension.field='stage_name'`, `chartType='funnel'`). Isso garante que os dados das **Taxas de Conversão** venham **exatamente da mesma fonte** que o funil visual.

### Alterações

**Arquivo: `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`**

1. Importar `useVisualData` e `AggregatedDataPoint`
2. Criar config estática de funil e chamar `useVisualData` com `chartType='funnel'`
3. Substituir o cálculo de `stageConversions` para usar os dados retornados pelo hook (mesma lógica de `ConfigurableFunnel.tsx`):
   - Separar "Ganhos" dos estágios regulares
   - Calcular cumulativos de baixo para cima usando "Ganhos" como base
   - Computar taxas de conversão entre etapas consecutivas
   - Computar conversão total como `Ganhos / cumulative[0]`
4. Passar `wonDeals` e `totalDeals` derivados do mesmo dataset para `ConversionScoreCards`

### Resultado Esperado
Os valores e percentuais nas Taxas de Conversão serão **idênticos** aos do Funil de Vendas, pois derivam da mesma query.
