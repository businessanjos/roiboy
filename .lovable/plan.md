

## Campos Personalizados como Colunas na Tabela de Dados

### Problema
O visual de tabela (`data_table`) exibe apenas colunas fixas pré-definidas (Título, Valor, Status, Etapa, etc.). Os campos personalizados do negócio — que frequentemente contêm informações críticas — não aparecem como opções de coluna.

### Solução
Carregar dinamicamente os campos personalizados (`custom_fields` com `show_in_deals = true`) e adicioná-los como opções de coluna selecionáveis no modal de criação e na renderização da tabela.

### Alterações

**1. `ConfigurableTable.tsx` — Colunas dinâmicas de campos personalizados**
- Criar hook `useCustomFieldColumns(dataSource)` que busca `custom_fields` ativos para o data source (inicialmente `deals`, depois `leads`)
- Gerar `TableColumnDef[]` dinâmicas com `key: 'cf_${field.id}'`, lendo o valor de `record.extra?.custom_fields?.[fieldId]`
- Exportar função `getColumnsForDataSourceWithCustomFields(dataSource, customFields)` que concatena colunas fixas + dinâmicas
- Na renderização, formatar valores conforme `field_type` (currency, date, select com label, multi_select, text)

**2. `AddVisualModal.tsx` — Mostrar campos personalizados na lista de colunas**
- Quando `chartType === 'data_table'` e `tableDataSource === 'deals'`, buscar campos personalizados via query ao Supabase (`custom_fields` com `show_in_deals = true`, `is_active = true`)
- Renderizar os campos personalizados abaixo das colunas fixas na seção "Colunas", com um separador "Campos Personalizados"
- Chaves no formato `cf_${field.id}` para distinguir de colunas nativas

**3. `useVisualDrilldown.ts` — Enriquecer `DrilldownRecord.extra` com valores de campos personalizados**
- Quando `config.tableConfig?.columns` contém chaves `cf_*`, extrair os field IDs
- Após buscar os deals, fazer batch query em `deal_field_values` para esses fields
- Mapear valores para `extra.custom_fields = { [fieldId]: displayValue }`
- Para campos `select`: converter `value_text` (option value) em label usando field options
- Para campos `multi_select`: converter `value_json` array em labels separados por vírgula

**4. Edge Function (`shared-dashboard/index.ts`) — Suporte server-side**
- Em `computeDealTableRecords`, replicar a mesma lógica: quando `tableConfig.columns` tem `cf_*`, buscar `deal_field_values` e `custom_fields` options, e popular `extra.custom_fields`

**5. `SharedVisualCard.tsx` — Renderizar colunas dinâmicas no compartilhamento**
- Ao montar colunas no `SharedDataTable`, incluir colunas `cf_*` do `tableConfig.columns` com label e getValue lendo de `extra.custom_fields`

### Arquivos alterados
- `src/components/insights/visuals/ConfigurableTable.tsx`
- `src/components/insights/AddVisualModal.tsx`
- `src/hooks/useVisualDrilldown.ts`
- `supabase/functions/shared-dashboard/index.ts`
- `src/components/insights/visuals/SharedVisualCard.tsx`

