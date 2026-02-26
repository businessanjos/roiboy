

## Simplificar fluxo de criacao do Funil

### Problema

O funil atualmente passa pelos mesmos 3 passos dos outros visuais (tipo -> metrica -> agrupamento), oferecendo opcoes que nao fazem sentido para ele, como "Valor Total (R$)" ou "Ticket Medio". O funil mede **processos sequenciais** -- quantos itens passaram por cada etapa -- nao metricas financeiras.

### Solucao

Transformar o funil em um visual de 2 passos (como ranking, gauge, etc.) com um fluxo dedicado:

- **Passo 1**: Selecionar tipo de visual (Funil)
- **Passo 2**: Escolher qual processo medir + titulo

No passo 2, o usuario escolhe entre processos disponiveis:

| Processo | Descricao | Config gerada |
|----------|-----------|---------------|
| Etapas de Vendas | Quantos negocios estao/passaram por cada etapa do pipeline | dataSource: deals, aggregation: count, dimension: stage_name |
| Etapas de Tarefas | Quantas tarefas por status (Pendente, Em Andamento, Concluida) | dataSource: tasks, aggregation: count, dimension: status |

Cada processo gera automaticamente a configuracao correta sem o usuario precisar escolher metrica ou agrupamento.

### Arquivo alterado

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/insights/AddVisualModal.tsx` | Adicionar fluxo dedicado de 2 passos para o funil com selecao de processo |

### Detalhes tecnicos

**1. totalSteps** -- Incluir `'funnel'` na lista de chart types com 2 passos (junto com ranking, gauge, etc.)

**2. Novo estado** -- `funnelProcess` com tipo `'deal_stages' | 'task_status'`

**3. Passo 2 do funil** -- Renderizar opcoes de processo (cards selecionaveis como os do gauge):
- "Etapas de Vendas" -- Progresso dos negocios pelo pipeline de vendas
- "Etapas de Tarefas" -- Distribuicao das tarefas por status

**4. handleCreate para funnel** -- Gerar config fixa baseada no processo escolhido:

```text
deal_stages:
  dataSource: 'deals'
  measure: { field: '', aggregation: 'count' }
  dimension: { field: 'stage_name', type: 'text' }
  formatting: { type: 'decimal', decimals: 0 }
  titulo auto: "Funil de Vendas"

task_status:
  dataSource: 'tasks'
  measure: { field: '', aggregation: 'count' }
  dimension: { field: 'status', type: 'text' }
  formatting: { type: 'decimal', decimals: 0 }
  titulo auto: "Funil de Tarefas"
```

**5. canCreate para funnel** -- `funnelProcess !== null && title.trim() !== '' && activeDashboardId !== null`

**6. Auto-generate title** -- Atualizar o useEffect de titulo para gerar "Funil de Vendas" ou "Funil de Tarefas" conforme o processo selecionado

