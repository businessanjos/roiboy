

## Adicionar Filtro por Campo do Lead nos Visuais

### Resumo

Adicionar uma nova secao "Filtro por Lead" na janela de ajustes de todos os visuais (VisualQuickSettings). O usuario podera selecionar um campo do Lead (MQL, Canal ou Faturamento Atual) e marcar quais opcoes desse campo devem ser incluidas no visual.

### Como vai funcionar

1. Na janela de ajustes do visual, aparecera uma nova secao "Filtro por Lead"
2. Um dropdown permite selecionar o campo: MQL, Canal ou Faturamento Atual
3. Ao selecionar um campo, as opcoes disponiveis aparecem como checkboxes
4. Apenas os registros com leads que possuem os valores selecionados serao incluidos no visual
5. Se nenhum filtro for selecionado, o visual exibe todos os dados (comportamento atual)

### Campos disponiveis e suas opcoes

- **MQL**: SIM - Acima de 30k, NAO - Abaixo de 30k
- **Canal**: Organico, Trafego Pago, Indicacao, Prospeccao ativa, Trafego Alheio, Esteira/Carteira, Social Seller, Recorrencia
- **Faturamento Atual**: Valores livres (texto) - o sistema buscara os valores unicos existentes no banco

### Secao tecnica

**1. Tipo VisualConfig (`src/components/insights/visual-builder/types.ts`)**

Adicionar nova propriedade ao `VisualConfig`:

```typescript
leadFieldFilter?: {
  fieldId: string;       // UUID do campo (MQL, Canal, Faturamento)
  fieldName: string;     // Nome do campo para exibicao
  selectedValues: string[]; // Labels selecionados (ex: ["Trafego Pago", "Organico"])
};
```

**2. VisualQuickSettings (`src/components/insights/visuals/VisualQuickSettings.tsx`)**

- Adicionar secao "Filtro por Lead" com:
  - Select para escolher o campo (MQL, Canal, Faturamento Atual)
  - Ao selecionar, buscar opcoes: para MQL e Canal, usar os `options` do `custom_fields`; para Faturamento, buscar valores unicos de `lead_field_values`
  - Checkboxes para marcar quais opcoes incluir
- Estado local: `leadFieldFilter` inicializado a partir de `config.leadFieldFilter`
- No `handleSave`, persistir `leadFieldFilter` no config

**3. Filtragem nos dados (`src/hooks/useVisualData.ts` e `src/hooks/useStackedVisualData.ts`)**

Quando `config.leadFieldFilter` estiver presente com `selectedValues.length > 0`:

- **Para Deals (`fetchDealsData`)**: Buscar `lead_id` dos deals, consultar `lead_field_values` para o `fieldId` especificado, e filtrar apenas deals cujos leads possuem um dos valores selecionados
- **Para Leads (`fetchLeadsData`)**: Mesma logica, filtrar leads pela tabela `lead_field_values`
- **Para Stacked (`fetchStackedDealsData`)**: Aplicar o mesmo filtro

A logica de filtragem sera:
1. Apos buscar os registros, extrair os IDs relevantes (deal_id ou lead_id)
2. Buscar `lead_field_values` para o `fieldId` do filtro
3. Mapear `value_text` para labels (usando mapa de opcoes para campos select)
4. Manter apenas registros cujo lead possui um valor que esta em `selectedValues`

**4. Constantes de referencia**

Utilizar os UUIDs ja conhecidos:
- MQL Lead: `e4270e93-e9b9-4d9b-9589-d614ce335bcd`
- Canal Lead: `3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a`
- Faturamento Atual Lead: `e352a1ca-cfbc-435a-95f7-2f53b5cac041`

| Arquivo | Mudanca |
|---------|---------|
| `types.ts` | Adicionar `leadFieldFilter` ao `VisualConfig` |
| `VisualQuickSettings.tsx` | Nova secao de UI com select + checkboxes + busca de opcoes |
| `useVisualData.ts` | Funcao auxiliar para filtrar por lead field + integrar em `fetchDealsData` e `fetchLeadsData` |
| `useStackedVisualData.ts` | Integrar filtro por lead field em `fetchStackedDealsData` |
