

## Diagnóstico: Divergência entre Funil e Taxas de Conversão

### Problema Identificado

O **Funil de Vendas** inclui a etapa "Venda" (deals ganhos) na sua contagem cumulativa de baixo para cima, enquanto as **Taxas de Conversão** calculam a contagem cumulativa apenas com as etapas do pipeline (sem incluir "Venda").

Exemplo da imagem:
- Funil mostra **Chegou Lead = 87**, **Contato Realizado = 59**
- Taxas de Conversão mostram **84 em Chegou Lead**, **57 em Contato Realizado**

A diferença (87 vs 84, 59 vs 57) ocorre porque o funil soma os deals ganhos (wonCount) na base e acumula para cima, mas o cálculo das Taxas de Conversão em `WhatsAppDashboardPanel.tsx` (linhas 112-116) não inclui o estágio "Venda" no acumulador.

### Correção

**Arquivo:** `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`

Adicionar os deals ganhos (totalWonDeals) como base do acumulador no cálculo de `stageConversions`, replicando a mesma lógica do funil:

1. Calcular `totalWonDeals` a partir de `stages.reduce((sum, s) => sum + (s.wonCount || 0), 0)`
2. Usar `totalWonDeals` como o valor base (bottom) na construção do array `cumulativeCounts`, em vez de começar com 0
3. Isso alinhará os números cumulativos (87, 59, etc.) com o funil

### Resultado Esperado
Os valores exibidos nas Taxas de Conversão passarão a ser idênticos aos do Funil de Vendas.

