
## Corrigir metricas do Dashboard de Gestao (Retencao, Valor Perdido, Evolucao Mensal)

### Problemas identificados

Apos analise dos dados no banco, encontrei **3 bugs criticos** que explicam por que os cards e o grafico estao incorretos:

1. **Cancelamentos/encerramentos sempre zerados no grafico**: O codigo usa a coluna `status_changed_at` para contar eventos por mes, porem essa coluna esta **sempre NULL** no banco. A data real esta na coluna `cancelled_at`.

2. **Status incorretos no codigo**: O codigo procura pelo status `"churned"` para contar cancelamentos, mas no banco o status real e `"cancelled"`. Alem disso, os status `"dismissed"` e `"dropout_7d"` nao sao contabilizados.

3. **Novos sub-contados**: O codigo so conta como "novos" contratos que **atualmente** tem status `"active"`. Ou seja, um contrato criado em agosto que foi cancelado em janeiro nao aparece como "novo" em agosto. Todos os contratos devem contar como "novos" no mes de criacao, independente do status atual.

### Dados reais (ultimos meses)

| Mes | Novos (real) | Cancelamentos | Demissoes | Encerramentos |
|-----|-------------|---------------|-----------|---------------|
| ago/25 | 19 | 5 | 0 | 0 |
| set/25 | 27 | 7 | 1 | 0 |
| out/25 | 23 | 3 | 1 | 0 |
| nov/25 | 17 | 1 | 0 | 0 |
| dez/25 | 19 | 2 | 1 | 0 |
| jan/26 | 49 | 9 | 16+1 | 153 |
| fev/26 | 11 | 1 | 1 | 3 |

Com esses dados reais, a taxa de retencao de fevereiro deveria ser muito diferente de 100%.

### Solucao

#### 1. Corrigir `monthlyChartData` (calculo do grafico)

- Usar `cancelled_at` em vez de `status_changed_at` para determinar o mes do evento
- Contar **todos** contratos como "novos" pelo `start_date`, independente do status atual
- Mapear os status corretamente:
  - `"cancelled"` e `"dropout_7d"` -> Cancelamentos
  - `"dismissed"` -> Cancelamentos (ou categoria propria se preferir)
  - `"ended"` -> Encerramentos
  - `"paused"` e `"suspended"` -> Congelamentos

#### 2. Corrigir `retentionMetrics`

Nenhuma mudanca necessaria aqui pois ele ja deriva de `monthlyChartData`. Corrigindo os dados de entrada, a taxa sera calculada corretamente.

#### 3. Corrigir `lostFinancialValue`

- Usar `cancelled_at` em vez de `status_changed_at`
- Mapear `"cancelled"` em vez de `"churned"` para o calculo de valor de cancelamentos
- Incluir `"dismissed"` no calculo

#### 4. Corrigir a query de busca de contratos (`useContractData`)

- Incluir `cancelled_at` no SELECT
- Ajustar o filtro OR para tambem considerar `cancelled_at` no periodo

### Arquivos afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useDashboardData.tsx` | Adicionar `cancelled_at` ao SELECT e ao filtro da query `useContractData` |
| `src/pages/Dashboard.tsx` | Corrigir `monthlyChartData` para usar `cancelled_at` e mapear status corretos; corrigir `lostFinancialValue` da mesma forma |

### Detalhes tecnicos

**useDashboardData.tsx - useContractData:**
```typescript
// SELECT: adicionar cancelled_at
.select("id, status, status_changed_at, cancelled_at, start_date, value, client_id")

// Filtro: incluir cancelled_at
.or(`start_date.gte.${...},status_changed_at.gte.${...},cancelled_at.gte.${...}`)
```

**Dashboard.tsx - monthlyChartData:**
```typescript
// Novos: contar TODOS contratos pelo start_date (remover filtro de status)
if (contract.start_date) {
  const startKey = format(parseISO(contract.start_date), "yyyy-MM");
  if (months[startKey]) months[startKey].novos++;
}

// Saidas: usar cancelled_at em vez de status_changed_at
const exitDate = contract.cancelled_at || contract.status_changed_at;
if (exitDate && contract.status !== "active") {
  const key = format(parseISO(exitDate), "yyyy-MM");
  if (months[key]) {
    if (["cancelled", "dismissed", "dropout_7d"].includes(contract.status)) {
      months[key].cancelamentos++;
    } else if (contract.status === "ended") {
      months[key].encerramentos++;
    } else if (["paused", "suspended"].includes(contract.status)) {
      months[key].congelamentos++;
    }
  }
}
```

**Dashboard.tsx - lostFinancialValue:**
```typescript
// Usar cancelled_at em vez de status_changed_at
const changedAt = parseISO(contract.cancelled_at || contract.status_changed_at);

// Mapear status corretos
if (["cancelled", "dismissed", "dropout_7d"].includes(contract.status)) {
  cancelamentosValue += contract.value || 0;
} else if (contract.status === "ended") {
  demissoesValue += contract.value || 0;
}
```
