

## Contagem de Calls Comerciais por Negócio (1 por deal)

### Problema
Atualmente, o visual "Calls Comerciais" conta cada tarefa individualmente. Se um vendedor tem 2 tarefas "Call Comercial Agendada" no mesmo negócio, conta como 2. O correto é contar **1 por negócio** (deduplica por `deal_id`).

### Solução
Incluir `deal_id` na query e deduplicar a contagem usando Sets de `deal_id` por usuário, em vez de incrementar contadores simples.

### Arquivos afetados

**1. `src/hooks/useVisualData.ts`** — função `fetchTasksCallCommercialData` (linhas ~1511-1558)
- Adicionar `deal_id` ao select da query
- Trocar contadores numéricos por `Set<string>` de deal_ids por usuário
- Scheduled: conta deal_ids únicos de tarefas "Agendada" sem `completed_at`
- Completed: conta deal_ids únicos de tarefas "Concluída" com `completed_at`
- Resultado final usa `.size` dos Sets

**2. `supabase/functions/shared-dashboard/index.ts`** — função `computeCallCommercialData` (linhas ~873-904)
- Mesma alteração: adicionar `deal_id` ao select, usar Sets para deduplicar

### Lógica de deduplicação (ambos os arquivos)
```text
userMap: Map<userName, { scheduledDeals: Set<string>, completedDeals: Set<string> }>

Para cada task:
  - Se "Agendada" e !completed_at e tem deal_id → scheduledDeals.add(deal_id)
  - Se "Concluída" e completed_at e tem deal_id → completedDeals.add(deal_id)

Resultado: value = scheduledDeals.size, count = completedDeals.size
```

Tarefas sem `deal_id` continuarão sendo contadas individualmente (fallback com o id da task).

