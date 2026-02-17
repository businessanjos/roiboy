

## Adicionar agrupamento "Por Canal" nos graficos de barras

### Resumo

Adicionar a opcao "Por Canal" na lista de agrupamentos disponiveis no modal "Adicionar Visual", permitindo que graficos de barras (e outros tipos) agrupem dados de leads pelo campo `canal` (coluna nativa da tabela `leads`).

### Contexto tecnico

O campo `canal` ja e uma coluna direta na tabela `leads` (nao e campo personalizado), portanto nao precisa de enriquecimento especial como MQL ou Faturamento. Basta:

1. Adicionar a opcao no modal
2. Mapear a dimensao para o campo correto
3. Incluir `canal` no SELECT da query de leads
4. Tratar o valor no agrupamento

### Mudancas

**1. `src/components/insights/AddVisualModal.tsx`**

- Adicionar `'canal'` ao tipo `GroupBy`
- Adicionar opcao na lista `GROUP_BY_OPTIONS`:
  ```
  { value: "canal", label: "Por Canal", description: "Canal de aquisicao do lead" }
  ```
- Adicionar mapeamento em `GROUP_BY_TO_DIMENSION`:
  ```
  canal: { field: 'canal', type: 'text' }
  ```
- Adicionar label em `GROUP_LABELS`:
  ```
  canal: "por Canal"
  ```

**2. `src/hooks/useVisualData.ts`**

- Na funcao `fetchLeadsData`, adicionar `canal` ao SELECT:
  ```
  .select('id, status, source, revenue_range, canal, created_at')
  ```
- Na funcao `getGroupKey`, adicionar tratamento para o campo `canal`:
  ```
  if (field === 'canal') {
    return item.canal || 'Nao informado';
  }
  ```

**3. `src/components/insights/visual-builder/types.ts`**

- Adicionar `canal` como opcao de dimensao para leads em `DATA_SOURCE_FIELDS`:
  ```
  { value: 'canal', label: 'Canal', type: 'text' }
  ```

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `AddVisualModal.tsx` | Novo tipo, opcao, mapeamento e label para "canal" |
| `useVisualData.ts` | Incluir `canal` no SELECT e no `getGroupKey` |
| `types.ts` (visual-builder) | Adicionar `canal` nas dimensoes de leads |

