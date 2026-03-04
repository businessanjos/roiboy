

## Segmentação por Campo Personalizado (Breakdown/Legenda)

### O que será feito

Adicionar uma opção em "Ajustes do Visual" para selecionar um campo personalizado (de Lead ou Negócio) como **segmentação/legenda**. Quando selecionado, o gráfico de barras se transforma em barras empilhadas, mostrando a composição por valores do campo (ex: MQL = "SIM - Acima de 30k" vs "NÃO - Abaixo de 30k").

### Arquitetura

Atualmente, `stackBy` no `VisualConfig` aceita apenas campos built-in (`responsible_name`, `canal`, etc.) e é usado exclusivamente com `chart_type = 'bar_stacked'`. A nova funcionalidade precisa:

1. Permitir que **qualquer gráfico de barras/linha** ative um breakdown por campo personalizado
2. Buscar os valores do campo customizado e injetá-los nos registros antes de agrupar

### Alterações

#### 1. `VisualConfig` — novo campo `stackByCustomField`

```typescript
stackByCustomField?: {
  fieldId: string;
  fieldName: string;
  source: 'lead' | 'deal'; // de qual entidade vem o campo
};
```

Quando definido, o visual será tratado como stacked independentemente do `chart_type` original.

#### 2. `useStackedVisualData.ts` — suporte a custom field como série

Na função `fetchStackedDealsData`:
- Quando `config.stackByCustomField` está definido (e `source === 'deal'`), buscar `deal_field_values` para o campo, enriquecer cada deal com o label do valor, e usar como série
- Quando `source === 'lead'`, buscar `lead_field_values` via `lead_id` dos deals
- Para `fetchStackedLeadsData`: mesma lógica invertida

Nova função genérica de enriquecimento:
```typescript
async function enrichWithCustomField(
  records: any[],
  accountId: string,
  fieldId: string,
  source: 'lead' | 'deal',
  idField: string // 'id' para deals, 'id' para leads
): Promise<any[]>
```

Essa função busca `deal_field_values` ou `lead_field_values`, resolve labels de select/multi_select a partir de `custom_fields.options`, e injeta `_custom_stack_label` em cada registro.

#### 3. `ConfigurableVisualCard.tsx` — ativar modo stacked

Alterar a detecção de `isStacked`:
```typescript
const isStacked = (chartType === 'bar_stacked' && !!config?.stackBy) 
  || !!config?.stackByCustomField;
```

Isso faz com que o visual use `useStackedVisualData` automaticamente quando um campo personalizado for selecionado.

#### 4. `VisualQuickSettings.tsx` — nova seção de UI

Adicionar seção "Segmentar por Campo Personalizado" (antes da aparência):
- Dropdown para selecionar a origem: "Campo de Lead" / "Campo de Negócio"
- Dropdown para selecionar qual campo personalizado
- Botão de limpar para remover a segmentação
- Visível apenas para chart types que suportam stacking (bar, bar_horizontal, line, bar_stacked)

Estado local:
```typescript
const [stackByCustomField, setStackByCustomField] = useState(config?.stackByCustomField || null);
```

No `handleSave`, incluir no `newConfig`:
```typescript
stackByCustomField: stackByCustomField || undefined,
// Quando custom field está ativo, garantir que stackBy também esteja definido
stackBy: stackByCustomField ? '_custom' : config.stackBy,
```

#### 5. `useStackedVisualData.ts` — lógica de agrupamento

Na seção de agrupamento (deals, linhas ~183-207), substituir o acesso direto a `sellerName` por uma função genérica:

```typescript
const getSeriesValue = (record: any): string => {
  if (config.stackByCustomField) {
    return record._custom_stack_label || 'Não informado';
  }
  return (record.users as any)?.name || 'Sem Responsável';
};
```

Mesma alteração para leads (linhas ~311 e ~393).

### Arquivos afetados

- `src/components/insights/visual-builder/types.ts` — adicionar `stackByCustomField` ao `VisualConfig`
- `src/hooks/useStackedVisualData.ts` — enriquecer registros com custom field e usar como série
- `src/components/insights/visuals/ConfigurableVisualCard.tsx` — expandir detecção de `isStacked`
- `src/components/insights/visuals/VisualQuickSettings.tsx` — nova seção de UI para seleção do campo

