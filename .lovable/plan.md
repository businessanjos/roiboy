

## Adicionar medição por Tarefas nos visuais do Insights

### Contexto atual

A fonte de dados "Tarefas" no visual builder esta limitada: so tem a dimensao "Vendedor" e nenhum campo numerico, e o fetch de dados (`fetchTasksCallCommercialData`) esta hardcoded para buscar apenas tarefas do tipo "Call Comercial". Isso impede que o usuario crie visuais para analisar tarefas por tipo de atividade, status, ou ao longo do tempo.

### O que sera feito

Expandir a fonte de dados "Tarefas" para permitir analises completas, incluindo contagem de tarefas agrupadas por tipo de atividade, vendedor, status (pendente/concluida) e data.

### Mudancas

#### 1. Expandir campos disponiveis para Tarefas (`src/components/insights/visual-builder/types.ts`)

Adicionar novas dimensoes e campos ao `DATA_SOURCE_FIELDS.tasks`:

```
tasks: {
  numeric: [],  // Mantém vazio - tarefas so suportam contagem
  dimension: [
    { value: 'activity_type', label: 'Tipo de Atividade', type: 'text' },
    { value: 'assigned_to', label: 'Vendedor', type: 'text' },
    { value: 'status', label: 'Status (Pendente/Concluída)', type: 'text' },
    { value: 'due_date', label: 'Data de Vencimento', type: 'date' },
    { value: 'created_at', label: 'Data de Criação', type: 'date' },
  ],
}
```

#### 2. Criar funcao generica de fetch de tarefas (`src/hooks/useVisualData.ts`)

Criar uma nova funcao `fetchTasksData` que:
- Busca tarefas da tabela `internal_tasks` com joins para `activity_types` (nome do tipo) e `users` (nome do vendedor)
- Aplica filtros de data (startDate/endDate) no campo `due_date`
- Aplica filtro de usuario se selecionado
- Paginacao para buscar todos os registros (loop de 1000 em 1000)
- Agrupa os dados pela dimensao escolhida:
  - `activity_type`: agrupa pelo nome do tipo de atividade
  - `assigned_to`: agrupa pelo nome do vendedor
  - `status`: agrupa em "Pendente" vs "Concluída"
  - `due_date` / `created_at`: agrupa por periodo (dia/semana/mes/ano)
- Retorna contagem de tarefas por grupo

#### 3. Atualizar o switch de dataSource (`src/hooks/useVisualData.ts`)

Alterar o case `tasks` para usar a nova funcao generica quando o chart type nao for `call_commercial`, mantendo compatibilidade:

```typescript
case 'tasks':
  result = await fetchTasksData(
    currentUser.account_id, measure, dimension, filters, dateDisplayFormat
  );
  break;
```

A funcao `fetchTasksCallCommercialData` sera mantida intacta e continuara sendo usada pelo chart type `call_commercial` (que tem seu proprio fluxo de renderizacao).

#### 4. Atualizar o drilldown de tarefas (`src/hooks/useVisualDrilldown.ts`)

Atualizar a funcao `fetchTasksRecords` para suportar as novas dimensoes (activity_type, status, due_date, created_at) alem da existente (assigned_to), garantindo que o "Explorar Dados" funcione corretamente para os novos visuais.

### Resultado esperado

O usuario podera criar visuais como:
- "Quantidade de Tarefas por Tipo de Atividade" (barra/pizza)
- "Tarefas por Vendedor" (barra/ranking)
- "Tarefas Pendentes vs Concluidas" (pizza/barra)
- "Evolucao de Tarefas por Mes" (linha/barra)
- Scorecards com total de tarefas

### Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/insights/visual-builder/types.ts` | Expandir dimensoes de tasks (activity_type, status, due_date, created_at) |
| `src/hooks/useVisualData.ts` | Nova funcao `fetchTasksData` generica + atualizar switch case |
| `src/hooks/useVisualDrilldown.ts` | Atualizar `fetchTasksRecords` para novas dimensoes |

