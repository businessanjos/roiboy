

## Seletor de Colunas no "Explorar Dados"

### O que será feito
Adicionar um botão "Colunas" no header do DrilldownDialog que abre um popover com checkboxes para selecionar quais colunas exibir. Inclui colunas nativas do data source + campos personalizados. Com muitas colunas, a tabela terá scroll horizontal.

### Alterações

**1. `DrilldownDialog.tsx` — Refatoração principal**
- Adicionar state `selectedColumns: string[]` inicializado com colunas padrão do data source
- Buscar campos personalizados do negócio via query (`custom_fields` com `show_in_deals/show_in_leads = true`)
- Adicionar botão com ícone `Columns` (lucide) ao lado do subtítulo que abre um `Popover` com:
  - Lista de colunas nativas com checkboxes
  - Separador "Campos Personalizados"
  - Lista de campos personalizados com checkboxes (`cf_${id}`)
- Construir `TableColumnDef[]` dinamicamente a partir de `selectedColumns`, reutilizando `getColumnsForDataSource()` para nativas e gerando dinâmicas para `cf_*`
- Passar `selectedColumns` (com `cf_*` keys) para o `useVisualDrilldown` via config para que `enrichWithCustomFields` carregue os valores necessários
- Envolver a `<Table>` em um container com `overflow-x: auto` para scroll horizontal
- Atualizar `handleExport` para exportar apenas as colunas selecionadas

**2. `useVisualDrilldown.ts` — Aceitar colunas extras**
- Na chamada de `enrichWithCustomFields`, além de `config.tableConfig?.columns`, também aceitar colunas passadas via parâmetro opcional `extraCfColumns` para suportar o drilldown dinâmico
- Alterar a interface `UseVisualDrilldownParams` para incluir `extraColumns?: string[]`

### Fluxo do usuário
1. Abre "Explorar Dados" → vê colunas padrão (Nome, Valor, Status, Data, Etapa, Responsável)
2. Clica no botão "Colunas" → popover com todas as opções + campos personalizados
3. Marca/desmarca colunas → tabela atualiza instantaneamente
4. Se muitas colunas, scroll horizontal aparece automaticamente

### Arquivos alterados
- `src/components/insights/visuals/DrilldownDialog.tsx`
- `src/hooks/useVisualDrilldown.ts`

