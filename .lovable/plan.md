

## Plano: Garantir paridade total usando cache direto do React Query

### Diagnóstico

Apesar de usar a config do visual salvo, a chamada `useVisualData` no `WhatsAppDashboardPanel` pode estar gerando uma queryKey ligeiramente diferente da usada pelo `ConfigurableVisualCard` (por exemplo, serialização de propriedades `undefined`, referências de objeto, ou timing de renderização). Isso resulta em duas queries separadas que retornam dados com +1 de diferença.

### Solução Definitiva

Eliminar a chamada `useVisualData` do `WhatsAppDashboardPanel`. Em vez disso, usar `useQueryClient()` para ler **diretamente o cache** da query que o `ConfigurableVisualCard` já executou. Isso garante 100% de paridade pois lê exatamente os mesmos dados — não uma cópia, os mesmos bytes.

### Alterações

**Arquivo: `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`**

1. Remover import de `useVisualData`
2. Importar `useQueryClient` do `@tanstack/react-query`, `useCurrentUser` e `useInsightsFilters`
3. Substituir a chamada `useVisualData` por leitura direta do cache:

```typescript
const queryClient = useQueryClient();
const { currentUser } = useCurrentUser();
const { filters } = useInsightsFilters();

const funnelVisual = visuals.find(v => v.chart_type === 'funnel');
const funnelConfig = funnelVisual?.config || null;

// Read directly from the React Query cache — same data as the funnel card
const funnelData = queryClient.getQueryData<AggregatedDataPoint[]>(
  ['visual-data', funnelConfig, funnelVisual?.chart_type || 'funnel', filters, currentUser?.account_id]
) || [];
```

4. O restante da lógica cumulativa permanece inalterado (já está correto), pois agora opera sobre os mesmos dados exatos.

### Resultado Esperado
Os valores nas Taxas de Conversão serão **idênticos** aos do Funil de Vendas pois leem a mesma entrada de cache.

