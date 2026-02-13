

## Adicionar agrupamento "Por Faturamento Atual" nos visuais de Leads

### Objetivo
Permitir criar visuais de Leads agrupados pelo campo personalizado "Faturamento Atual", que esta armazenado na tabela `lead_field_values` (field_id: `e352a1ca-cfbc-435a-95f7-2f53b5cac041`).

### Mudancas

**1. AddVisualModal (`src/components/insights/AddVisualModal.tsx`)**
- Adicionar `'faturamento_atual'` ao tipo `GroupBy`
- Adicionar opcao na lista `GROUP_BY_OPTIONS`: `{ value: 'faturamento_atual', label: 'Por Faturamento Atual', description: 'Faixa de faturamento do lead' }`
- Adicionar mapeamento em `GROUP_BY_TO_DIMENSION`: `faturamento_atual: { field: 'faturamento_atual', type: 'text' }`
- Adicionar label em `GROUP_LABELS`: `faturamento_atual: 'por Faturamento Atual'`

**2. Tipos do visual builder (`src/components/insights/visual-builder/types.ts`)**
- Adicionar `{ value: 'faturamento_atual', label: 'Faturamento Atual', type: 'text' }` na lista de dimensoes de `leads`

**3. Enriquecimento de dados (`src/hooks/useVisualData.ts`)**
- Criar funcao `enrichLeadsWithFaturamento(accountId, leads)` seguindo o mesmo padrao de `enrichLeadsWithMql`:
  1. Buscar valores em `lead_field_values` onde `field_id = 'e352a1ca-cfbc-435a-95f7-2f53b5cac041'`
  2. Mapear `lead_id -> value_text` (o valor ja e o label: "Entre 20 e 30 mil reais", etc.)
  3. Injetar `faturamento_atual` em cada lead (ou "Nao informado" quando ausente)
- Integrar na `fetchLeadsData`: quando `dimension.field === 'faturamento_atual'`, chamar `enrichLeadsWithFaturamento` antes de agregar
- Atualizar `getGroupKey` para reconhecer `field === 'faturamento_atual'` e retornar `item.faturamento_atual || 'Nao informado'`

### O que nao muda
- Nenhuma alteracao no banco de dados
- Visuais existentes nao sao afetados
- O campo nativo `revenue_range` da tabela leads continua disponivel separadamente como "Faixa de Faturamento"
