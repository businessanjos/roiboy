

## Visual de Tabela para Insights

### Objetivo
Adicionar um novo tipo de visualização **"Tabela"** ao sistema de Insights, permitindo que o usuário configure quais colunas exibir, com barra de rolagem interna quando o conteúdo excede o tamanho do widget.

### Arquitetura

O visual de tabela reutiliza a mesma infraestrutura de dados do drilldown (`useVisualDrilldown`), mas renderizado inline dentro do widget do grid em vez de um dialog.

### Alterações

#### 1. Registrar o tipo `data_table` no sistema de tipos
**Arquivo:** `src/components/insights/visual-builder/types.ts`

- Adicionar `'data_table'` ao tipo `ChartType`
- Adicionar opção `{ value: 'data_table', label: 'Tabela' }` ao array `CHART_TYPE_OPTIONS`
- Adicionar novo campo opcional `tableConfig` ao `VisualConfig`:
```typescript
tableConfig?: {
  columns: string[]; // e.g. ['name', 'value', 'status', 'date', 'stage', 'responsible', 'email', 'source']
};
```

#### 2. Adicionar ícone ao seletor de tipo de gráfico
**Arquivo:** `src/components/insights/visual-builder/ChartTypeSelector.tsx`

- Adicionar `data_table: Table` ao `ICON_MAP` (importar `Table` de lucide-react)

#### 3. Criar componente `ConfigurableTable`
**Novo arquivo:** `src/components/insights/visuals/ConfigurableTable.tsx`

- Recebe `config: VisualConfig` como prop
- Usa `useVisualDrilldown` (sem `groupName`) para buscar todos os registros
- Renderiza uma tabela HTML com:
  - Cabeçalho fixo (sticky header)
  - Corpo com barra de rolagem vertical (`overflow-y: auto`) limitada ao espaço disponível do widget
  - Colunas configuráveis baseadas em `config.tableConfig.columns`
  - Colunas redimensionáveis via drag nos separadores do header
- Colunas disponíveis por dataSource:
  - **deals:** Título, Valor, Status, Data Criação, Data Ganho, Etapa, Responsável, Origem, Motivo Perda
  - **leads:** Nome, Status, Origem, Data Criação, Responsável, E-mail, Faturamento Atual
  - **tasks:** Título, Status, Tipo, Vendedor, Data Vencimento

#### 4. Integrar no `ConfigurableChart`
**Arquivo:** `src/components/insights/visuals/ConfigurableChart.tsx`

- Adicionar case `'data_table'` no switch que renderiza `<ConfigurableTable config={visualConfig!} />`
- A tabela não precisa de `data`/`formatting` pois busca seus próprios dados

#### 5. Integrar no `ConfigurableVisualCard`
**Arquivo:** `src/components/insights/visuals/ConfigurableVisualCard.tsx`

- Para `chartType === 'data_table'`, pular o fetch de `useVisualData` (não necessário)
- Manter drilldown desabilitado (a tabela já É os dados detalhados)

#### 6. Adicionar seleção de colunas no wizard
**Arquivo:** `src/components/insights/visual-builder/VisualBuilderSheet.tsx`

- Quando `chartType === 'data_table'`, após a seleção de DataSource, exibir checkboxes para escolher quais colunas incluir
- Pré-selecionar colunas padrão (Nome, Valor, Status, Data)
- Salvar em `config.tableConfig.columns`

#### 7. Adicionar seleção de colunas nos ajustes rápidos
**Arquivo:** `src/components/insights/visuals/VisualQuickSettings.tsx`

- Adicionar seção de checkboxes para editar colunas visíveis quando o visual for do tipo `data_table`

#### 8. Exportar novo componente
**Arquivo:** `src/components/insights/visuals/index.ts`

- Adicionar `export { ConfigurableTable } from "./ConfigurableTable";`

### Detalhes de implementação da tabela

- **Scroll interno:** O componente usa `overflow-auto` com `max-height: 100%` para caber dentro do card do grid. O header fica sticky com `position: sticky; top: 0`
- **Colunas redimensionáveis:** Implementar via `onMouseDown` nos separadores do header, atualizando larguras em estado local
- **Responsividade:** Quando o widget for pequeno, a tabela mostra scroll horizontal também
- **Performance:** Usar `LazyTableRows` do `lazy-table.tsx` existente para carregamento progressivo quando houver muitos registros

