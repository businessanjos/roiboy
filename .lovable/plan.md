
# Plano: Isolamento de Tarefas por Setor e Sincronização em Tempo Real

## Diagnóstico

### Problema 1: Tarefas de Operações aparecendo em Vendas
A página de Tarefas (`/tasks`) não está filtrando por setor ativo. Ela busca **todas** as tarefas e exibe indiscriminadamente:
- "Onboarding" (setor Operações) aparece junto com "Follow Up" (setor Vendas)
- Não há uso do contexto de setor (`useSector`)

### Problema 2: Status não sincroniza em tempo real
Quando uma atividade é marcada como concluída no detalhe do negócio (`DealActivitiesTab`), a página de Tarefas não reflete a mudança porque:
- `DealActivitiesTab` usa estado local (`useState`) em vez do React Query
- A função `handleToggleComplete` apenas chama `fetchTasks()` localmente, sem invalidar o cache global `["internal-tasks"]`
- Resultado: a aba Atividades mostra "Concluída" mas a aba Tarefas mostra "Atrasada"

---

## Solução

### Arquivo 1: `src/pages/Tasks.tsx`

**Mudanças:**
1. Importar o hook `useSector` do contexto
2. Incluir `sector_id` na query de `activity_types`
3. Adicionar filtro de setor no `filteredTasks`
4. Atualizar a interface `Task` para incluir `sector_id` do `activity_type`

```typescript
// Adicionar import
import { useSector } from "@/contexts/SectorContext";

// No componente Tasks():
const { currentSector } = useSector();

// Modificar a query para incluir sector_id:
activity_type:activity_types!internal_tasks_activity_type_id_fkey (id, name, color, sector_id)

// Atualizar interface Task:
activity_type?: {
  id: string;
  name: string;
  color: string | null;
  sector_id: string | null;  // <-- Adicionar
} | null;

// Adicionar filtro de setor no filteredTasks:
const filteredTasks = useMemo(() => tasks.filter((task) => {
  // ... filtros existentes ...

  // Filtro por setor
  const matchesSector = !currentSector?.id || 
    // Vendas: tarefas com activity_type de vendas OU deal_id não-nulo
    (currentSector.id === "vendas" && (
      task.activity_type?.sector_id === "vendas" || 
      (task.deal_id && !task.activity_type?.sector_id)
    )) ||
    // Operações: tarefas com activity_type de operações OU client_id sem deal_id
    (currentSector.id === "operacoes" && (
      task.activity_type?.sector_id === "operacoes" ||
      (task.client_id && !task.deal_id && !task.activity_type?.sector_id)
    ));

  return matchesSearch && matchesUser && matchesTab && matchesActivityType && matchesSector;
}), [tasks, searchTerm, filterUser, filterActivityType, currentUser?.id, activeTab, customStatuses, currentSector?.id]);
```

### Arquivo 2: `src/components/sales/DealActivitiesTab.tsx`

**Mudanças:**
1. Importar `useQueryClient` do React Query
2. Invalidar o cache global após atualizar uma tarefa

```typescript
// Adicionar import
import { useQueryClient } from "@tanstack/react-query";

// No componente:
const queryClient = useQueryClient();

// Modificar handleToggleComplete:
const handleToggleComplete = async (task: Task) => {
  // ... lógica existente ...

  const { error } = await supabase
    .from("internal_tasks")
    .update({
      custom_status_id: targetStatus.id,
      completed_at: targetStatus.is_completed_status ? new Date().toISOString() : null,
    })
    .eq("id", task.id);

  if (error) {
    console.error("Error updating task:", error);
  } else {
    fetchTasks();
    // ADICIONAR: Invalidar cache global para sincronizar com a aba Tarefas
    queryClient.invalidateQueries({ queryKey: ["internal-tasks"] });
  }
};
```

---

## Detalhes Técnicos

### Lógica de Isolamento por Setor

| Setor | Critério de Inclusão |
|-------|---------------------|
| Vendas | `activity_type.sector_id = 'vendas'` OU (`deal_id` existe E `sector_id` é null) |
| Operações | `activity_type.sector_id = 'operacoes'` OU (`client_id` existe E `deal_id` é null E `sector_id` é null) |

Esta lógica cobre:
1. Tarefas com tipo de atividade explicitamente atribuído a um setor
2. Tarefas legadas sem tipo de atividade mas com contexto (deal ou client)

### Por que a sincronização não funcionava?

O realtime do Supabase **está funcionando corretamente** - a subscrição na página de Tarefas escuta alterações na tabela `internal_tasks`. O problema é que o `DealActivitiesTab` não estava disparando a invalidação do cache do React Query ao marcar tarefas como concluídas, fazendo com que a UI da página de Tarefas não fosse re-renderizada com os dados atualizados.

---

## Resumo de Modificações

| Arquivo | Linha | Ação |
|---------|-------|------|
| `src/pages/Tasks.tsx` | ~3 | Importar `useSector` |
| `src/pages/Tasks.tsx` | ~129-133 | Adicionar `sector_id` na interface Task |
| `src/pages/Tasks.tsx` | ~165 | Obter `currentSector` do hook |
| `src/pages/Tasks.tsx` | ~210 | Incluir `sector_id` na query de activity_types |
| `src/pages/Tasks.tsx` | ~404-423 | Adicionar filtro `matchesSector` no filteredTasks |
| `src/components/sales/DealActivitiesTab.tsx` | ~2 | Importar `useQueryClient` |
| `src/components/sales/DealActivitiesTab.tsx` | ~92 | Declarar `queryClient` |
| `src/components/sales/DealActivitiesTab.tsx` | ~185 | Invalidar cache após atualização |

---

## Impacto Esperado

1. **Setor Vendas:** Exibirá apenas tarefas de vendas (Call Comercial, Follow Up, Proposta de Fechamento, etc.)
2. **Setor Operações:** Exibirá apenas tarefas operacionais (Onboarding, Implementação, Alinhamento, etc.)
3. **Sincronização:** Ao marcar uma atividade como concluída no detalhe do negócio, a aba Tarefas refletirá a mudança instantaneamente
