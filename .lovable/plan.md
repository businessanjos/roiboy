

## Adicionar dimensão "Vendedor" (Proprietário) nos visuais de Leads

### Problema
O visual "Leads por Vendedor" não exibe dados porque a dimensão "Vendedor" não existe nas opções de agrupamento de Leads, e a query de leads não busca informações de proprietário. O proprietário de um Lead é determinado pelo `responsible_user_id` do negócio (deal) mais recente associado àquele lead.

### Solução

**1. Adicionar dimensão "Vendedor" nos campos de Leads (`src/components/insights/visual-builder/types.ts`)**
- Incluir `{ value: 'responsible_name', label: 'Vendedor', type: 'text' }` na lista de dimensões de `leads`

**2. Criar função de enriquecimento no `src/hooks/useVisualData.ts`**
- Criar `enrichLeadsWithOwner(accountId, leads)` que:
  1. Busca todos os deals dos leads com `lead_id IN (...)` incluindo `responsible_user_id`
  2. Para cada lead, identifica o deal mais recente (por `created_at`)
  3. Busca os nomes dos usuários responsáveis na tabela `users`
  4. Injeta `responsible_name` em cada lead (ou "Sem Proprietário" quando não houver deal)

**3. Integrar na `fetchLeadsData`**
- Adicionar `responsible_name` como campo especial (similar ao tratamento de `mql`)
- Quando `dimension.field === 'responsible_name'`, chamar `enrichLeadsWithOwner` antes de agregar

### Detalhes técnicos

A lógica de enriquecimento segue o mesmo padrão de `enrichLeadsWithMql`:

```text
1. Coletar IDs dos leads
2. Buscar deals: SELECT id, lead_id, responsible_user_id, created_at FROM deals WHERE lead_id IN (...)
3. Agrupar por lead_id, pegar o deal mais recente
4. Coletar user IDs únicos dos responsáveis
5. Buscar nomes: SELECT id, name FROM users WHERE id IN (...)
6. Mapear: lead.responsible_name = user.name || 'Sem Proprietário'
```

Usa `queryInBatches` existente para lidar com grandes volumes.

### O que não muda
- Visuais de Deals (já têm "Vendedor" por `responsible_name` nativo)
- Lógica de proprietário no detalhe do Lead (continua dinâmica)
- Nenhuma alteração no banco de dados
