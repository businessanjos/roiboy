

## Reordenar paineis do Insights com drag-and-drop

### O que sera feito

Adicionar a possibilidade de arrastar e soltar os paineis na sidebar do Insights para reordena-los livremente. A nova ordem sera salva no banco de dados.

### Mudancas necessarias

**1. Banco de dados**

A tabela `insights_dashboards` nao possui uma coluna de ordenacao. Sera criada uma coluna `display_order` (integer, default 0) para persistir a ordem personalizada.

**2. Frontend - Drag and drop**

O projeto ja possui `@dnd-kit/core` e `@dnd-kit/sortable` instalados. Serao utilizados para implementar o arraste na lista de paineis.

### Arquivos afetados

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Adicionar coluna `display_order` integer default 0 na tabela `insights_dashboards` |
| `src/hooks/useInsightsDashboards.tsx` | Ordenar dashboards por `display_order` em vez de `created_at`; adicionar mutation `reorderDashboards` que atualiza o `display_order` de cada dashboard |
| `src/components/insights/sidebar/InsightsDashboardList.tsx` | Envolver a lista com `DndContext` e `SortableContext` do dnd-kit; receber callback `onReorder` |
| `src/components/insights/sidebar/InsightsDashboardItem.tsx` | Usar `useSortable` do dnd-kit para tornar cada item arrastavel (grip handle ou arrastar pelo item inteiro) |
| `src/components/insights/sidebar/InsightsSidebar.tsx` | Passar a funcao `reorderDashboards` para o `InsightsDashboardList` |

### Detalhes tecnicos

- A migracao inicializara `display_order` com base na ordem atual de `created_at` usando `ROW_NUMBER()`
- O query de fetch ordenara por `display_order ASC, created_at ASC`
- Ao soltar um item (`onDragEnd`), calcula a nova ordem e faz um batch update otimista no cache do react-query, seguido de updates individuais no banco
- O icone de grip (6 pontos) aparecera ao lado esquerdo de cada item, antes do icone do painel
- O padrao segue exatamente o que ja existe em `SortableFieldItem.tsx` do modulo de vendas

