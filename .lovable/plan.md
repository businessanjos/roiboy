

## Investigação: Discrepância entre "Leads por Faturamento Atual" e "QUANTIDADE DE LEADS - MQL"

### Diagnóstico

Analisei os configs dos dois visuais diretamente no banco de dados e encontrei que **não é um bug de código** — são configurações diferentes entre os dois visuais:

| | Scorecard "QUANTIDADE DE LEADS - MQL" | Barra "Leads por Faturamento Atual" |
|---|---|---|
| **dataSource** | `deals` | `leads` |
| **Filtro Lead - MQL** | SIM - Acima de 30k | SIM - Acima de 30k |
| **Filtro Lead - Canal** | Trafego Pago | ❌ Não tem |
| **Filtro Deal - Origem** | [TRAF-STUDIO-EC] | [TRAF-STUDIO-EC] |

**Três diferenças causam a discrepância:**

1. **DataSource diferente**: O scorecard conta **negócios** (`deals`), não leads. Um lead pode ter múltiplos negócios, ou nenhum, gerando contagens diferentes.

2. **Filtro adicional de Canal**: O scorecard exige Canal = "Trafego Pago", que o gráfico de barras não tem. Isso reduz o resultado do scorecard.

3. **Filtro de negócio ignorado no gráfico de barras**: O gráfico de barras tem `dealFieldFilters: Origem da Venda = [TRAF-STUDIO-EC]` configurado, mas a função `fetchLeadsData` **não aplica filtros de negócio** — ela só recebe e aplica `leadFilters`. Então esse filtro é silenciosamente ignorado, inflando a contagem.

### Bug real encontrado

Existe um bug real no ponto 3: quando um visual de dataSource `leads` tem `dealFieldFilters` configurados, eles são **ignorados** porque `fetchLeadsData` nunca recebe os `dealFilters`. Veja a chamada na linha 51:

```typescript
result = await fetchLeadsData(accountId, measure, dimension, filters, dateDisplayFormat, leadFilters);
// dealFilters nunca é passado!
```

### Correção proposta

**`src/hooks/useVisualData.ts`**:
1. Passar `dealFilters` e `dealStatusFilter` para `fetchLeadsData`
2. Dentro de `fetchLeadsData`, quando houver deal filters, buscar os `deal_id`s que satisfazem os filtros, pegar os `lead_id`s correspondentes, e filtrar os leads por essa interseção (semelhante à lógica de `filterByLeadFields` mas no sentido inverso: deal → lead)

A lógica seria:
- Buscar todos os deals do account com os deal field filters aplicados
- Extrair os `lead_id`s únicos desses deals
- Filtrar `allData` para incluir apenas leads cujo `id` está nesse conjunto

### Arquivos alterados
- `src/hooks/useVisualData.ts`

