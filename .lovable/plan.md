

## Plano: Usar `useVisualData` diretamente (reativo) em vez de `getQueryData` (snapshot estático)

### Causa Raiz

`queryClient.getQueryData()` é uma **leitura síncrona não-reativa** — ela captura o cache no momento da renderização mas **não re-renderiza** quando o cache é atualizado. Isso significa que:

1. Se o funil ainda não carregou quando o painel renderiza, `getQueryData` retorna `[]`
2. Quando o funil termina de carregar, as Taxas de Conversão **não atualizam** porque `getQueryData` não é um subscriber
3. O resultado são valores desatualizados ou vazios, explicando a discrepância persistente

### Solução

Voltar a usar o hook `useVisualData` diretamente (que é reativo e **subscreve** às mudanças do cache), passando exatamente os mesmos parâmetros que o `ConfigurableVisualCard` usa:

- `config`: `funnelVisual.config as VisualConfig`  
- `chartType`: `funnelVisual.chart_type` (não um fallback diferente)
- `enabled`: apenas quando o visual de funil existe

Como o React Query faz **deep equality** nas queryKeys, a mesma config + chartType + filters + accountId resultará no **reuso do cache existente** (sem fetch duplicado), mas com **reatividade** — quando o cache atualiza, o componente re-renderiza.

### Alterações

**Arquivo: `src/components/insights/whatsapp-dashboard/WhatsAppDashboardPanel.tsx`**

1. Re-importar `useVisualData` e remover `useQueryClient`
2. Substituir a leitura de cache estática por:

```typescript
const funnelVisual = visuals.find(v => v.chart_type === 'funnel');

const { data: funnelData } = useVisualData({
  config: (funnelVisual?.config as VisualConfig) || null,
  chartType: funnelVisual?.chart_type || 'funnel',
  enabled: !!funnelVisual?.config,
});
```

3. Remover imports não mais necessários: `useQueryClient`, `useCurrentUser`, `useInsightsFilters` (se não usados em outro lugar)

### Por que isso funciona

- `useVisualData` internamente usa `useQuery` com queryKey `['visual-data', config, chartType, filters, accountId]`
- O `ConfigurableVisualCard` do funil usa **exatamente** a mesma queryKey com os mesmos valores
- React Query reconhece a queryKey duplicada e **compartilha o cache** — uma única fetch serve ambos os componentes
- Ambos recebem os **mesmos dados** e re-renderizam juntos quando o cache atualiza

### Resultado Esperado

Os valores nas Taxas de Conversão (87 em Chegou Lead, 60 em Contato Realizado, 33 em Em Qualificação, 55%, etc.) serão **idênticos** aos do Funil de Vendas, pois ambos consomem o mesmo cache reativo.

