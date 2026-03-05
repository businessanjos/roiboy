

## Plano: Usar a config exata do visual de funil salvo

### Causa Raiz

O `WhatsAppDashboardPanel` cria uma **config hardcoded** para chamar `useVisualData`, enquanto o visual de funil dentro do `InsightsGrid` usa a **config salva no banco de dados** (que pode conter filtros adicionais como `leadFieldFilters`, `dealFieldFilters`, `statusFilter`, etc.). Essas duas configs geram queries diferentes, resultando na diferença de +1 em todas as contagens cumulativas.

### Solução

Em vez de usar uma config hardcoded, extrair a config do **visual de funil real** (do prop `visuals`) e usá-la diretamente na chamada a `useVisualData`. Isso garante que ambos os componentes compartilhem **exatamente o mesmo cache do React Query**, eliminando qualquer discrepância.

### Alterações

**Arquivo: `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`**

1. Encontrar o visual de funil nos `visuals` recebidos via props:
```typescript
const funnelVisual = visuals.find(v => v.chart_type === 'funnel');
```

2. Usar a config desse visual (ou fallback para a config hardcoded caso não exista):
```typescript
const funnelConfig = funnelVisual?.config || {
  dataSource: 'deals',
  measure: { field: 'value', aggregation: 'count' },
  dimension: { field: 'stage_name', type: 'text' },
  formatting: { type: 'decimal', decimals: 0 },
};
```

3. Passar `chartType` do visual real:
```typescript
const { data: funnelData } = useVisualData({ 
  config: funnelConfig, 
  chartType: funnelVisual?.chart_type || 'funnel' 
});
```

Isso faz com que o `queryKey` do React Query seja idêntico ao do `ConfigurableVisualCard`, compartilhando o cache e garantindo valores 100% iguais.

### Resultado Esperado
Valores e percentuais nas Taxas de Conversão serão **idênticos** aos do Funil de Vendas (87, 60, 33, etc.).

