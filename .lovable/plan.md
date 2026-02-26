

## Corrigir o Funil de Tarefas para exibir tipos de atividade na ordem correta

### Problema

O visual "Funil de Tarefas" atualmente agrupa por status (Concluída/Pendente) em vez de exibir os tipos de atividade na ordem sequencial do processo comercial. Deveria mostrar apenas tarefas concluídas, agrupadas por tipo de atividade, na ordem fixa definida.

### Ordem fixa dos tipos de atividade

1. Primeiro Contato Realizado
2. Ligacao Atendida
3. Ligacao Nao Atendida
4. No-Show
5. Call Comercial Agendada
6. Call Comercial Concluida
7. Proposta de Fechamento
8. Follow Up

### Logica cumulativa

O componente `ConfigurableFunnel` ja implementa soma cumulativa de baixo para cima. Os dados precisam apenas conter a contagem bruta de tarefas concluidas por tipo -- o funil cuida do resto.

### Alteracoes

**Arquivo 1: `src/hooks/useVisualData.ts`**

Adicionar tratamento especial para funnel de tarefas (apos linha 112):

- Quando `chartType === 'funnel'` e `dataSource === 'tasks'`, interceptar o resultado
- Filtrar apenas tarefas com `completed_at` (concluidas)
- Reagrupar por `activity_type` (nome do tipo de atividade)
- Ordenar segundo a ordem fixa definida acima
- Remover tipos que nao estao na lista fixa

Isso sera feito adicionando um bloco condicional apos o bloco existente de funnel de deals (linha ~112), que:
1. Re-processa os dados ja buscados pela `fetchTasksData` -- mas na verdade, como precisamos filtrar por `completed_at`, sera melhor buscar os dados com filtro direto
2. Cria uma funcao `fetchTasksFunnelData` dedicada que:
   - Busca tarefas com `completed_at` nao nulo (`.not('completed_at', 'is', null)`)
   - Agrupa por nome do tipo de atividade
   - Retorna na ordem fixa

**Arquivo 2: `src/components/insights/AddVisualModal.tsx`**

Atualizar a configuracao de criacao do funnel de tarefas (linha 403):

- Mudar `dimension.field` de `'status'` para `'activity_type'`
- Isso garante que novos funis de tarefas ja sejam criados com a dimensao correta

### Detalhes tecnicos

Nova funcao em `useVisualData.ts`:

```text
TASK_FUNNEL_ORDER = [
  'Primeiro Contato Realizado',
  'Ligação Atendida', 
  'Ligação não atendida',
  'No-Show',
  'Call Comercial Agendada',
  'Call Comercial Concluída',
  'Proposta de Fechamento',
  'Follow Up'
]

fetchTasksFunnelData(accountId, filters):
  1. Buscar tarefas com completed_at IS NOT NULL
  2. Agrupar por activity_type name
  3. Filtrar apenas tipos presentes em TASK_FUNNEL_ORDER
  4. Ordenar pela posicao no array
  5. Retornar AggregatedDataPoint[]
```

No bloco de switch de `dataSource === 'tasks'` (linha 52-57):
- Adicionar condicao: se `chartType === 'funnel'`, chamar `fetchTasksFunnelData` em vez de `fetchTasksData`

No bloco pos-processamento (linha 112-114):
- Adicionar condicao para `chartType === 'funnel' && dataSource === 'tasks'` para pular o sort descrescente por valor (a ordem ja esta fixa)

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useVisualData.ts` | Nova funcao `fetchTasksFunnelData` + condicional no switch de tasks |
| `src/components/insights/AddVisualModal.tsx` | Dimension field de `status` para `activity_type` no funnel de tarefas |

