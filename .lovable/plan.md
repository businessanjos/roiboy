

## Múltiplos Filtros por Lead e Negócio Simultâneos

### Problema atual
Cada visual suporta apenas **um** filtro por lead e **um** filtro por negócio. O usuário precisa filtrar por múltiplos campos personalizados simultaneamente (ex: Canal = "Outbound" **E** MQL = "Sim").

### Solução

Migrar de objetos únicos (`leadFieldFilter`, `dealFieldFilter`) para arrays (`leadFieldFilters`, `dealFieldFilters`), com retrocompatibilidade para configs existentes. Todos os filtros serão aplicados em **interseção (AND)**: o registro precisa atender a **todos** os filtros configurados.

### Alterações

#### 1. Tipo `VisualConfig` (`src/components/insights/visual-builder/types.ts`)
- Adicionar campos `leadFieldFilters` e `dealFieldFilters` como arrays opcionais do mesmo tipo de objeto
- Manter os campos legados `leadFieldFilter` / `dealFieldFilter` para retrocompatibilidade

```typescript
// Novo tipo para filtro individual
export interface FieldFilter {
  fieldId: string;
  fieldName: string;
  selectedValues: string[];
}

// Novos campos na VisualConfig
leadFieldFilters?: FieldFilter[];
dealFieldFilters?: FieldFilter[];
```

#### 2. Funções de filtragem (`useLeadFieldFilter.ts`, `useDealFieldFilter.ts`)
- Adicionar novas funções `filterByLeadFields` e `filterByDealFields` que recebem um **array** de filtros e aplicam cada um sequencialmente (AND logic — cada filtro reduz o conjunto de resultados)
- Manter as funções originais intactas para não quebrar nada

```typescript
export async function filterByDealFields<T extends { id: string }>(
  records: T[],
  accountId: string,
  filters: FieldFilter[]
): Promise<T[]> {
  let result = records;
  for (const filter of filters) {
    if (filter.selectedValues?.length > 0) {
      result = await filterByDealField(result, accountId, filter);
    }
  }
  return result;
}
```

#### 3. Hooks de dados (`useVisualData.ts`, `useStackedVisualData.ts`, `useVisualDrilldown.ts`)
- Criar helper que normaliza config legada + nova para array unificado:
```typescript
function getLeadFilters(config: VisualConfig): FieldFilter[] {
  if (config.leadFieldFilters?.length) return config.leadFieldFilters;
  if (config.leadFieldFilter?.fieldId) return [config.leadFieldFilter];
  return [];
}
```
- Substituir chamadas individuais de `filterByLeadField`/`filterByDealField` por `filterByLeadFields`/`filterByDealFields` usando o array normalizado

#### 4. UI — Seções de filtro (`LeadFieldFilterSection.tsx`, `DealFieldFilterSection.tsx`)
- Refatorar para receber/emitir um **array** de filtros
- Cada filtro aparece como uma linha com seletor de campo + checkboxes de valores + botão de remover
- Botão "Adicionar filtro" para inserir mais linhas
- Quando um campo já está selecionado em um filtro, ele não aparece nas opções dos outros (evitar duplicatas)

#### 5. `VisualQuickSettings.tsx`
- Migrar estado de filtro para arrays:
```typescript
const [leadFilters, setLeadFilters] = useState<FieldFilter[]>(
  getLeadFilters(config) // normaliza legado
);
const [dealFilters, setDealFilters] = useState<FieldFilter[]>(
  getDealFilters(config)
);
```
- No `handleSave`, salvar em `leadFieldFilters` / `dealFieldFilters` (novos campos array)
- Não salvar mais nos campos legados singulares (configs antigas continuam sendo lidas pelo helper de normalização)

### Garantias de não-conflito

1. **Aplicação sequencial (AND):** cada filtro reduz o conjunto — `filterByDealField(filterByDealField(records, f1), f2)` — impossível de se anularem
2. **Retrocompatibilidade:** helper de normalização lê tanto o formato antigo (objeto) quanto o novo (array)
3. **Sem duplicata de campo:** a UI impede selecionar o mesmo campo em dois filtros diferentes
4. **Filtros de lead e deal são independentes:** lead filters rodam sobre `lead_id`, deal filters sobre `deal_id` — operam em eixos diferentes, sem interferência

### Arquivos afetados
- `src/components/insights/visual-builder/types.ts`
- `src/hooks/useLeadFieldFilter.ts`
- `src/hooks/useDealFieldFilter.ts`
- `src/hooks/useVisualData.ts`
- `src/hooks/useStackedVisualData.ts`
- `src/hooks/useVisualDrilldown.ts`
- `src/components/insights/visuals/LeadFieldFilterSection.tsx`
- `src/components/insights/visuals/DealFieldFilterSection.tsx`
- `src/components/insights/visuals/VisualQuickSettings.tsx`

