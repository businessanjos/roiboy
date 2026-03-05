

## Plano: Visual customizado "Leads com Origem da Venda"

### O que será feito
Criar um componente de tabela customizado que exibe leads com a coluna "Origem da Venda" puxada do campo personalizado do negócio mais recente vinculado ao lead. Esse visual será integrado ao sistema existente como um novo tipo de visual ou como uma coluna enriquecida na tabela de leads.

### Abordagem
Como a tabela padrão de leads (`ConfigurableTable`) não suporta enriquecimento cross-entity (buscar dados de negócios para cada lead), a solução mais limpa é:

1. **Adicionar uma nova coluna virtual `deal_source`** ao `LEAD_COLUMNS` na `ConfigurableTable`
2. **Enriquecer os dados no `useVisualDrilldown`** durante o fetch de leads: após buscar os leads, fazer uma segunda query para buscar o negócio mais recente de cada lead e o valor do campo personalizado "Origem da Venda"

### Alterações

#### 1. `src/hooks/useVisualDrilldown.ts` — `fetchLeadsRecords()`
- Após buscar os leads, coletar todos os `lead.id`
- Buscar o negócio mais recente de cada lead na tabela `deals` (agrupando por `lead_id`, ordenando por `created_at DESC`, pegando apenas o primeiro)
- Buscar o campo personalizado "Origem da Venda" na tabela `custom_fields` pelo nome
- Buscar os valores em `deal_field_values` para os deal IDs encontrados
- Resolver os labels das opções (select/multi_select) usando o mapa de opções do campo
- Adicionar `extra.deal_source` em cada `DrilldownRecord` de lead

#### 2. `src/components/insights/visuals/ConfigurableTable.tsx`
- Adicionar nova coluna `deal_source` no `LEAD_COLUMNS`:
  ```
  { key: 'deal_source', label: 'Origem da Venda', defaultWidth: 160, getValue: (r) => r.extra?.deal_source || '-' }
  ```

### Lógica de enriquecimento (pseudocódigo)
```
1. Buscar todos os leads (já existente)
2. leadIds = leads.map(l => l.id)
3. Para cada lead, buscar o deal mais recente:
   - Query: deals WHERE lead_id IN (leadIds) ORDER BY created_at DESC
   - Agrupar por lead_id, pegar apenas o primeiro (mais recente)
4. Buscar campo "Origem da Venda" em custom_fields
5. Buscar deal_field_values para os deal IDs com field_id do campo encontrado
6. Resolver labels e mapear: leadId → label da Origem da Venda
7. Incluir no extra de cada DrilldownRecord
```

### Arquivos Afetados
- **Editar**: `src/hooks/useVisualDrilldown.ts` — enriquecer `fetchLeadsRecords` com dados de "Origem da Venda" do deal mais recente
- **Editar**: `src/components/insights/visuals/ConfigurableTable.tsx` — adicionar coluna `deal_source` ao `LEAD_COLUMNS`

