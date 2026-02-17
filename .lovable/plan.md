

## Adicionar Filtro por Campos Personalizados do Negocio nos Visuais

### Resumo

Adicionar uma nova secao "Filtro por Negocio" na janela de ajustes dos visuais, logo abaixo do filtro por Lead existente. O usuario podera selecionar qualquer campo personalizado do negocio (MQL, Canal de Venda, Item da Venda, Faturamento Atual, Origem da Venda, Ganhou Bonus, etc.) e marcar quais opcoes desse campo devem ser incluidas no visual.

### Como vai funcionar

1. Na janela de ajustes, aparecera uma nova secao "Filtro por Negocio" abaixo do "Filtro por Lead"
2. Um dropdown listara todos os campos personalizados dos negocios (buscados dinamicamente da tabela `custom_fields` com `show_in_deals = true`)
3. Ao selecionar um campo, as opcoes disponiveis aparecem como checkboxes (para campos select/multi_select: usa opcoes da definicao; para outros tipos: busca valores unicos de `deal_field_values`)
4. Apenas negocios que possuem um dos valores selecionados serao incluidos no visual
5. Se nenhum filtro for selecionado, o visual exibe todos os dados (comportamento atual)

### Secao tecnica

**1. Tipo VisualConfig (`src/components/insights/visual-builder/types.ts`)**

Adicionar nova propriedade:

```
dealFieldFilter?: {
  fieldId: string;
  fieldName: string;
  selectedValues: string[];
};
```

**2. Novo componente (`src/components/insights/visuals/DealFieldFilterSection.tsx`)**

Seguindo o mesmo padrao do `LeadFieldFilterSection`:
- Busca campos com `show_in_deals = true` da tabela `custom_fields` (dinamico, nao hardcoded)
- Ao selecionar um campo, busca as opcoes: se campo tipo select/multi_select, usa `options` da definicao; senao, busca valores unicos de `deal_field_values`
- Exibe checkboxes para selecionar quais valores incluir

**3. VisualQuickSettings (`src/components/insights/visuals/VisualQuickSettings.tsx`)**

- Adicionar estado local para `dealFilterFieldId`, `dealFilterFieldName`, `dealFilterValues`
- Renderizar `DealFieldFilterSection` entre o `LeadFieldFilterSection` e o `AppearanceSection`
- No `handleSave`, persistir `dealFieldFilter` no config
- No `useEffect` de reset, inicializar a partir de `config.dealFieldFilter`

**4. Utilitario de filtragem (`src/hooks/useDealFieldFilter.ts`)**

Nova funcao `filterByDealField` que:
- Recebe array de deals, accountId e o filtro
- Busca `deal_field_values` para o `fieldId` do filtro nos IDs dos deals
- Mapeia labels para values (para campos select) e filtra apenas deals com valores correspondentes
- Retorna array filtrado

**5. Integracao nos hooks de dados (`src/hooks/useVisualData.ts` e `src/hooks/useStackedVisualData.ts`)**

- Importar e aplicar `filterByDealField` apos o fetch dos deals e apos o filtro de lead (se houver)
- Aplicar apenas quando `config.dealFieldFilter?.selectedValues?.length > 0`

| Arquivo | Mudanca |
|---------|---------|
| `types.ts` | Adicionar `dealFieldFilter` ao `VisualConfig` |
| `DealFieldFilterSection.tsx` | Novo componente (mesmo estilo do LeadFieldFilterSection) |
| `VisualQuickSettings.tsx` | Novo estado + renderizar DealFieldFilterSection + persistir no save |
| `useDealFieldFilter.ts` | Nova funcao utilitaria de filtragem por campo do deal |
| `useVisualData.ts` | Integrar filtro por deal field apos fetch dos deals |
| `useStackedVisualData.ts` | Integrar filtro por deal field apos fetch dos deals |
