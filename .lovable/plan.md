
# Plano: Corrigir Cálculo de Taxa de Conversão por Vendedor

## Problema Identificado

O visual "Conversão por Vendedor" está mostrando a taxa de conversão agrupada por **mês** ao invés de por **vendedor** porque:

1. A função `fetchDealsData()` detecta que é `conversion_rate` e chama `calculateConversionRateByPeriod()`
2. A função `calculateConversionRateByPeriod()` **sempre agrupa por período de data** (`dateGrouping`), ignorando o campo de dimensão real (`responsible_name`)
3. O código usa `formatDateGroup(deal.created_at, dateGrouping, ...)` para criar as chaves de grupo, independente do tipo de dimensão

## Solução

Criar uma lógica que detecta se a dimensão é de **texto** (como vendedor, etapa, etc.) ou **data** e aplique o agrupamento correto.

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useVisualData.ts` | Criar nova função para calcular conversão por dimensão textual e atualizar a lógica de roteamento |

## Mudanças Específicas

### 1. Atualizar Roteamento na `fetchDealsData()` (linhas 95-102)

```typescript
if (measure.aggregation === 'conversion_rate') {
  if (dimension.field === '_total') {
    return calculateConversionRate(accountId, filters);
  } else if (dimension.type === 'text') {
    // NOVO: Agrupar por campo textual (vendedor, etapa, etc.)
    return calculateConversionRateByTextDimension(accountId, filters, dimension);
  } else {
    // Agrupar por período de data
    return calculateConversionRateByPeriod(accountId, filters, dimension, dateDisplayFormat);
  }
}
```

### 2. Criar Nova Função `calculateConversionRateByTextDimension()`

Esta função irá:
1. Buscar todos os deals no período
2. Agrupar por campo textual (ex: `responsible_user_id`)
3. Para cada grupo, calcular: `(deals ganhos / total deals) * 100`

```typescript
async function calculateConversionRateByTextDimension(
  accountId: string,
  filters: any,
  dimension: VisualConfig['dimension']
): Promise<AggregatedDataPoint[]> {
  // Buscar todos os deals com dados do vendedor
  let query = supabase
    .from('deals')
    .select(`
      id, status, created_at, won_at,
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq('account_id', accountId);

  // Aplicar filtros de data (usando created_at para total)
  if (filters.startDate) query = query.gte('created_at', filters.startDate);
  if (filters.endDate) query = query.lte('created_at', filters.endDate);
  if (filters.userId && filters.userId !== 'all') {
    query = query.eq('responsible_user_id', filters.userId);
  }

  const { data, error } = await query;
  if (error) return [];

  // Agrupar por vendedor
  const groups = new Map<string, { total: number; won: number }>();

  for (const deal of data || []) {
    // Obter nome do vendedor
    const groupName = deal.users?.name || 'Sem Responsável';

    if (!groups.has(groupName)) {
      groups.set(groupName, { total: 0, won: 0 });
    }

    const group = groups.get(groupName)!;
    group.total++;

    // Verificar se foi ganho no período
    if (deal.status === 'won' && deal.won_at) {
      const wonDate = new Date(deal.won_at);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;

      if ((!startDate || wonDate >= startDate) && (!endDate || wonDate <= endDate)) {
        group.won++;
      }
    }
  }

  // Calcular taxa por vendedor
  const result: AggregatedDataPoint[] = [];
  for (const [name, { total, won }] of groups) {
    if (name !== 'Sem Responsável') {  // Filtrar deals sem responsável
      result.push({
        name,
        value: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0,
        count: total
      });
    }
  }

  // Ordenar por taxa de conversão (maior primeiro)
  result.sort((a, b) => b.value - a.value);

  return result;
}
```

## Comportamento Esperado

| Visual | Antes | Depois |
|--------|-------|--------|
| Conversão por Vendedor | Mostra barra única "Jan/26" com taxa global | Mostra barra para cada vendedor com sua taxa individual |
| Conversão por Etapa | Mostra por mês | Mostra taxa por etapa do funil |
| Conversão por Mês | Continua funcionando | Sem alterações |

## Exemplo de Resultado

```
┌─────────────────────────────────────────────────────────────┐
│        Conversão por Vendedor (Corrigido)                   │
├─────────────────────────────────────────────────────────────┤
│  Everton Pieri    ████████████████████  15.2%              │
│  João Silva       ████████████         10.5%              │
│  Maria Santos     █████████             8.3%              │
│  Carlos Lima      ██████                5.1%              │
└─────────────────────────────────────────────────────────────┘
```

## Suporte a Outras Dimensões Textuais

A nova função deve suportar múltiplos campos de dimensão:

| Campo | Agrupamento |
|-------|-------------|
| `responsible_name` | Por nome do vendedor |
| `stage_name` | Por etapa do funil |
| `source` | Por origem do lead |
| `lost_reason` | Por motivo de perda |

Isso é feito usando a função `getGroupKey()` existente ou mapeando o campo diretamente para o campo apropriado na query.
