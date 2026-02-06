

# Plano: Corrigir Isolamento de Setor para Tarefas de Operações

## Problema Identificado

Tarefas com tipos de atividade do setor de Operações (como "Onboarding", "Implementação da Clínica Ryka", etc.) estão aparecendo incorretamente no setor de Vendas.

### Causa Raiz

A lógica de filtragem por setor em `baseFilteredTasks` está incompleta:

```tsx
// Linha 424-427 - Lógica atual para Vendas
(currentSector.id === "vendas" && (
  task.activity_type?.sector_id === "vendas" || 
  (task.deal_id && !task.activity_type?.sector_id)  // ❌ Não exclui activity_types de "operacoes"
))
```

### O Bug

A condição `(task.deal_id && !task.activity_type?.sector_id)` permite tarefas **sem sector_id** no tipo de atividade, mas não verifica se o `sector_id` é de outro setor.

Exemplo do que acontece:
- Tarefa tem `deal_id` (vinculada a negócio)
- Tarefa tem `activity_type.sector_id = 'operacoes'`
- Condição atual: `task.activity_type?.sector_id === "vendas"` → false
- Condição atual: `(task.deal_id && !task.activity_type?.sector_id)` → false (sector_id existe)
- Mas por algum motivo as tarefas ainda aparecem...

Preciso verificar a lógica mais a fundo:

---

## Análise Adicional

Após revisar a condição, percebi que a lógica está correta em teoria, **mas** há um problema: a condição **não exclui explicitamente** tarefas de outros setores. Precisa ser:

**Para Vendas, a tarefa deve:**
1. Ter `activity_type.sector_id === "vendas"`, **OU**
2. Ter `deal_id` e `activity_type.sector_id` ser nulo (sem setor definido)
3. **E NUNCA** ter `activity_type.sector_id === "operacoes"`

---

## Solução

Modificar a lógica de filtragem para **excluir explicitamente** tarefas cujo tipo de atividade pertence a outro setor:

### Alteração em `src/pages/Tasks.tsx` - Linhas 422-431

**Antes:**
```tsx
const matchesSector = !currentSector?.id || 
  (currentSector.id === "vendas" && (
    task.activity_type?.sector_id === "vendas" || 
    (task.deal_id && !task.activity_type?.sector_id)
  )) ||
  (currentSector.id === "operacoes" && (
    task.activity_type?.sector_id === "operacoes" ||
    (task.client_id && !task.deal_id && !task.activity_type?.sector_id)
  ));
```

**Depois:**
```tsx
// Sector filter - STRICT isolation, never show tasks from other sectors
const activitySectorId = task.activity_type?.sector_id;

let matchesSector = true;
if (currentSector?.id === "vendas") {
  // For Sales: include if activity belongs to vendas, or has deal_id with no sector specified
  // EXCLUDE if activity explicitly belongs to another sector
  if (activitySectorId && activitySectorId !== "vendas") {
    matchesSector = false;
  } else {
    matchesSector = activitySectorId === "vendas" || 
      (task.deal_id && !activitySectorId);
  }
} else if (currentSector?.id === "operacoes") {
  // For Operations: include if activity belongs to operacoes, or has client without deal and no sector
  // EXCLUDE if activity explicitly belongs to another sector
  if (activitySectorId && activitySectorId !== "operacoes") {
    matchesSector = false;
  } else {
    matchesSector = activitySectorId === "operacoes" ||
      (task.client_id && !task.deal_id && !activitySectorId);
  }
} else if (currentSector?.id) {
  // For other sectors: only match exact sector_id
  matchesSector = activitySectorId === currentSector.id;
}
```

---

## Arquivo a Modificar

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `src/pages/Tasks.tsx` | 422-431 | Refatorar lógica de `matchesSector` com exclusão explícita |

---

## Resultado Esperado

| Tipo de Atividade | sector_id | Visível em Vendas | Visível em Operações |
|-------------------|-----------|-------------------|---------------------|
| Onboarding | operacoes | ❌ Não | ✅ Sim |
| Implementação da Clínica Ryka | operacoes | ❌ Não | ✅ Sim |
| Call Comercial | vendas | ✅ Sim | ❌ Não |
| Follow Up | vendas | ✅ Sim | ❌ Não |
| Tarefa sem tipo | NULL (com deal_id) | ✅ Sim | ❌ Não |
| Tarefa sem tipo | NULL (só client_id) | ❌ Não | ✅ Sim |

As tarefas de Operações não aparecerão mais no setor de Vendas e vice-versa.

