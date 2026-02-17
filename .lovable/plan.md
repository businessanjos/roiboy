

## Adicionar metrica "Negocios Ganhos" ao Scorecard

### O que sera feito

Adicionar uma nova opcao de metrica chamada **"Negocios Ganhos"** ao Scorecard, que conta apenas negocios convertidos com status "won".

### Mudancas

**`src/components/insights/AddVisualModal.tsx`**

1. Adicionar `won_deals_count` ao tipo `Metric`:
   ```
   type Metric = "revenue" | "deals_count" | ... | "won_deals_count" | "meta";
   ```

2. Adicionar na lista `METRICS` (apos `deals_count`):
   ```
   { value: "won_deals_count", label: "Negocios Ganhos", description: "Contagem de deals convertidos em ganho" }
   ```

3. Adicionar em `METRIC_TO_CONFIG`:
   ```
   won_deals_count: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'decimal', statusFilter: 'won' }
   ```
   Isso usa `statusFilter: 'won'` para filtrar apenas negocios ganhos (mesmo padrao ja usado por `revenue` e `avg_ticket`).

4. Adicionar em `METRIC_LABELS`:
   ```
   won_deals_count: "Negocios Ganhos"
   ```

### Resultado

O usuario podera criar um Scorecard que exibe a contagem de negocios ganhos no periodo filtrado, utilizando o mesmo mecanismo de `statusFilter: 'won'` ja existente.

