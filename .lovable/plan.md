

## Adicionar "Tabela" ao modal de criação de visuais

O tipo `data_table` foi registrado no `VisualBuilderSheet` (editor avançado), mas o modal principal de criação (`AddVisualModal.tsx`) tem sua própria lista de tipos separada que não inclui a tabela.

### Alteração — `src/components/insights/AddVisualModal.tsx`

1. **Importar ícone `Table`** de lucide-react (linha 13)

2. **Adicionar `"data_table"` ao tipo local `ChartType`** (linha 23)

3. **Adicionar entrada na lista `CHART_TYPES`** (após o funil, linha 39):
   ```typescript
   { value: "data_table", label: "Tabela", description: "Exibir registros detalhados em formato de tabela", icon: Table }
   ```

4. **Definir `totalSteps = 2`** para `data_table` (linha 162) — a tabela não precisa de métrica/agrupamento, apenas selecionar colunas e título

5. **Adicionar lógica de criação** no `handleCreate` para `data_table`:
   - Criar config com `dataSource: 'deals'`, dimensão genérica
   - Incluir `tableConfig.columns` com colunas padrão
   - Layout maior: `w: 12, h: 6`

6. **Adicionar UI do step 2** para `data_table`:
   - Seleção de fonte de dados (Negócios, Leads, Tarefas, Produtos)
   - Checkboxes para selecionar colunas disponíveis
   - Campo de título

