

## Adicionar "Quantidade de Tarefas" como opcao de medicao no wizard de visuais

### Problema

A opcao de medicao por tarefas foi implementada no backend (`useVisualData.ts`) e nos tipos do visual builder (`types.ts`), mas o wizard principal de criacao de visuais (`AddVisualModal.tsx`) - que e o dialog de 3 passos usado pelos usuarios - nao foi atualizado. Por isso, "Tarefas" nao aparece na lista do Passo 2.

### Solucao

Atualizar o `AddVisualModal.tsx` para incluir a nova metrica de tarefas e seus agrupamentos validos.

### Mudancas no arquivo `src/components/insights/AddVisualModal.tsx`

#### 1. Adicionar `tasks_count` ao tipo `Metric` (linha 24)

```
type Metric = "revenue" | "deals_count" | "won_deals_count" | "avg_ticket" | "conversion" | "lost_reasons" | "leads_count" | "sales_cycle" | "meta" | "tasks_count";
```

#### 2. Adicionar opcao na lista `METRICS` (linha 41-51)

Inserir apos `sales_cycle`:

```
{ value: "tasks_count", label: "Quantidade de Tarefas", description: "Contagem de tarefas por tipo, vendedor ou status" },
```

#### 3. Adicionar mapeamento em `METRIC_TO_CONFIG` (linha 64-80)

```
tasks_count: { dataSource: 'tasks', measureField: null, aggregation: 'count', formatType: 'decimal' },
```

#### 4. Adicionar label em `METRIC_LABELS` (linha 107-117)

```
tasks_count: "Tarefas",
```

#### 5. Adicionar agrupamentos validos para tarefas no `GROUP_BY_OPTIONS` (linha 53-61)

Adicionar uma nova opcao:

```
{ value: "activity_type" as const, label: "Por Tipo de Atividade", description: "Tipo da tarefa (call, reuniao, etc.)" },
```

E atualizar o tipo `GroupBy` (linha 25) para incluir `activity_type` e `status_task`:

```
type GroupBy = "month" | "user" | "stage" | "product" | "mql" | "faturamento_atual" | "canal" | "activity_type" | "status_task";
```

Adicionar tambem:

```
{ value: "status_task" as const, label: "Por Status da Tarefa", description: "Pendente vs Concluída" },
```

#### 6. Adicionar mapeamento em `GROUP_BY_TO_DIMENSION` (linha 82-90)

```
activity_type: { field: 'activity_type', type: 'text' },
status_task: { field: 'status', type: 'text' },
```

#### 7. Adicionar `GROUP_LABELS` para novos agrupamentos (linha 119-127)

```
activity_type: "por Tipo de Atividade",
status_task: "por Status",
```

#### 8. Filtrar opcoes de agrupamento conforme a metrica selecionada (Passo 3, ~linha 782)

No passo 3, filtrar as opcoes de `GROUP_BY_OPTIONS` para que:
- Quando `metric === 'tasks_count'`: mostrar apenas `month`, `user`, `activity_type`, `status_task`
- Quando `metric === 'leads_count'`: mostrar apenas `month`, `user`, `mql`, `faturamento_atual`, `canal`
- Demais metricas (deals): mostrar `month`, `user`, `stage`, `product`

Isso sera feito com um `filteredGroupByOptions` computado antes do render do Passo 3.

#### 9. Ajustar `getDateFieldForMetric` para tasks

Para `tasks_count`, o campo de data sera `due_date` (ja implementado no `useVisualData.ts`):

```
case 'tasks_count':
  return 'due_date';
```

### Resultado

O usuario vera "Quantidade de Tarefas" como opcao no Passo 2 do wizard, e no Passo 3 podera agrupar por Mes, Vendedor, Tipo de Atividade ou Status da Tarefa.

### Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/insights/AddVisualModal.tsx` | Adicionar metric `tasks_count`, novos GroupBy (`activity_type`, `status_task`), mapeamentos e filtragem de opcoes por metrica |
