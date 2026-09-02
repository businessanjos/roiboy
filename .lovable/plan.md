# Atividades do negócio: seleção múltipla e ordenação por vencimento

Melhorias na aba **Atividades** do negócio (painel do pipeline), atendendo aos dois pedidos.

## 1. Selecionar e excluir várias de uma vez

- Botão **Selecionar** no cabeçalho da lista ativa o modo de seleção.
- No modo seleção, cada atividade (pendentes e concluídas) ganha uma caixa de marcação própria, sem abrir a atividade ao clicar.
- Barra de ação aparece com "N selecionadas", **Marcar todas**, **Limpar** e **Excluir selecionadas**.
- Excluir pede confirmação em um diálogo, apaga tudo em uma única operação e atualiza a lista e os indicadores do card do negócio.
- Sair do modo de seleção limpa a marcação.

## 2. Ordenação por data/hora de vencimento

- Padrão passa a ser **vencimento mais antigo primeiro** (data + hora), em vez da data de criação. Assim, uma atividade retroativa aparece no topo, e não no fim.
- Atividades sem data de vencimento vão para o fim da lista.
- Pequeno seletor de ordenação no cabeçalho: **Vencimento (mais antiga)**, **Vencimento (mais recente)**, **Criação (mais recente)**. A escolha fica salva no navegador.
- Concluídas continuam agrupadas embaixo, ordenadas pela conclusão mais recente.

## Detalhes técnicos

- Arquivo único: `src/components/sales/DealActivitiesTab.tsx`.
- Estado local novo: `selectionMode`, `selectedIds: Set<string>`, `sortMode` (persistido em `localStorage`).
- Busca: manter o `order("created_at")` no banco e ordenar em memória por `due_date` + `due_time` (nulos por último), para não depender de índice/coluna extra.
- Exclusão em lote: `supabase.from("internal_tasks").delete().in("id", ids)`, seguida de `fetchTasks()` e invalidação de `internal-tasks`, `batch-deal-activity-status` e `deal-activity-status`.
- Confirmação com `AlertDialog` do shadcn; feedback com toast.
- O clique no checkbox de conclusão continua funcionando fora do modo de seleção (comportamento atual preservado).
