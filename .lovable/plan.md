

## Alternância rápida de tipo de gráfico dentro do visual

### O que será feito
Adicionar um botão no header de cada visual (ao lado dos ícones existentes de Explorar Dados, Ajustes e Info) que abre um popover/dropdown com os tipos de gráfico compatíveis. Ao selecionar, o `chart_type` do visual é atualizado no banco sem precisar recriar o visual — todos os filtros, medidas e dimensões são preservados.

### Tipos intercambiáveis
Nem todos os tipos são intercambiáveis (scorecard, gauge, indicator, bubble_map, data_table têm estruturas de dados muito diferentes). A alternância será limitada a tipos que compartilham a mesma estrutura de dados:

```text
Grupo "Gráfico padrão": bar, bar_horizontal, line, pie
Grupo "Empilhado": bar_stacked (mantém sozinho, sem alternância)
Grupo "Especial": number, scorecard, ranking, call_commercial, gauge, indicator, bubble_map, funnel, data_table (sem alternância)
```

O botão de alternância só aparecerá para visuais do grupo "Gráfico padrão".

### Alterações

**1. `src/components/insights/visuals/ConfigurableVisualCard.tsx`**
- Importar `Popover`, `PopoverTrigger`, `PopoverContent` do shadcn
- Importar ícones correspondentes (`BarChart3`, `LineChart`, `PieChart`, `ArrowLeftRight`)
- Adicionar estado local para controlar o popover
- Definir constante `SWITCHABLE_TYPES` com os 4 tipos intercambiáveis e seus ícones/labels
- Renderizar botão com ícone `ArrowLeftRight` (ou similar) no header, apenas quando `chartType` pertence ao grupo intercambiável
- Ao clicar num tipo, chamar `onUpdateVisual(visual.id, { chart_type: novoTipo })` — a mesma função já usada pelo QuickSettings
- O visual re-renderiza automaticamente porque o `chart_type` muda no banco e o React Query invalida

**2. Nenhuma outra alteração necessária**
- `ConfigurableChart` já suporta todos os tipos via switch/case
- `useVisualData` usa `chartType` no queryKey mas a query em si não muda para esses 4 tipos
- O banco já aceita qualquer string em `chart_type`

### UX
- Ícone discreto no header (consistente com os existentes)
- Popover compacto com 4 opções em grid (ícone + label curto)
- Tipo atual destacado visualmente
- Mudança instantânea (otimistic update)

