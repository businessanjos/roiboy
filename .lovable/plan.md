

# Plano: Corrigir Exibição de "Sem status" em Tarefas Concluídas

## Diagnóstico

Algumas tarefas aparecem como "Sem status" mesmo estando claramente concluídas (com texto riscado). Isso ocorre porque:

1. O sistema possui dois mecanismos de conclusão:
   - **Antigo**: campo `completed_at` (timestamp de conclusão)
   - **Novo**: campo `custom_status_id` (referência ao status "Concluído")

2. Tarefas concluídas antes da implementação do sistema de status personalizado têm apenas `completed_at` preenchido, mas `custom_status_id` permanece NULL.

3. A lógica visual está inconsistente:
   - **Riscado (linha 565-567)**: verifica `completed_at` → funciona corretamente
   - **Label de status (linha 592)**: depende apenas de `custom_status_id` → mostra "Sem status"

## Solução

Adicionar fallback inteligente: quando `custom_status_id` é NULL mas `completed_at` existe, automaticamente usar o status de conclusão configurado.

### Alteração em `src/pages/Tasks.tsx`

**Linha 534 - Antes:**
```tsx
const taskStatus = customStatuses.find(s => s.id === task.custom_status_id);
```

**Depois:**
```tsx
// Find the custom status, or fallback to completed status if task has completed_at
let taskStatus = customStatuses.find(s => s.id === task.custom_status_id);
if (!taskStatus && task.completed_at) {
  // Task was completed via legacy method, find the first completed status
  taskStatus = customStatuses.find(s => s.is_completed_status);
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Tasks.tsx` | Linha 534: adicionar fallback para status de conclusão |

## Resultado Esperado

- Tarefas com `completed_at` mas sem `custom_status_id` exibirão "Concluído" ao invés de "Sem status"
- O ícone verde e a cor do status serão exibidos corretamente
- Consistência visual entre o texto riscado e o badge de status

