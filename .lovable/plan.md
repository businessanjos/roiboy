

# Solução Permanente: Correção do Visual de Faturamento

## Diagnóstico Final

Existem **dois problemas** que causam o visual de Faturamento não exibir dados:

### Problema 1: Erro de Coluna na Query (Bug Crítico)
O código tenta buscar `users.full_name`, mas a coluna correta é `users.name`:

| Arquivo | Linha | Erro |
|---------|-------|------|
| `useVisualData.ts` | 88 | `users...full_name` → coluna não existe |
| `useVisualData.ts` | 256 | `item.users?.full_name` → undefined |

Isso faz a query do Supabase falhar silenciosamente, retornando array vazio.

### Problema 2: Mapeamento Fixo no Modal de Criação (Causa Raiz)
O `AddVisualModal.tsx` sempre usa `created_at` para agrupamento "Por Mês", independente da métrica:

```typescript
// Linha 58-59 - PROBLEMA: hardcoded created_at
const GROUP_BY_TO_DIMENSION = {
  month: { field: 'created_at', type: 'date', dateGrouping: 'month' },
  // ...
};
```

Quando o usuário escolhe "Faturamento por Mês", o sistema deveria usar `won_at` (data de ganho), não `created_at`.

---

## Solução Proposta

### Correção 1: Erro de Coluna (Imediata)

Corrigir `full_name` para `name` nos arquivos:

**Arquivo:** `src/hooks/useVisualData.ts`
- Linha 88: `users!...full_name` → `users!...name`
- Linha 256: `item.users?.full_name` → `item.users?.name`

**Arquivo:** `src/hooks/useVisualDrilldown.ts`
- Linha 225: `item.users?.full_name` → `item.users?.name`

---

### Correção 2: Lógica Inteligente de Campo de Data (Permanente)

Modificar o `AddVisualModal.tsx` para selecionar automaticamente o campo de data correto baseado na métrica escolhida:

```text
Se métrica = "revenue" (Faturamento)
  → Usar won_at (data de ganho)

Se métrica = "lost_reasons" (Perdas)
  → Usar lost_at (data de perda)

Qualquer outra métrica
  → Usar created_at (data de criação)
```

**Implementação:**

```typescript
// Função para determinar campo de data baseado na métrica
const getDateFieldForMetric = (metric: Metric): string => {
  switch (metric) {
    case 'revenue':     // Faturamento = negócios GANHOS
    case 'avg_ticket':  // Ticket médio também baseado em ganhos
      return 'won_at';
    case 'lost_reasons': // Perdas = negócios PERDIDOS
      return 'lost_at';
    default:
      return 'created_at';
  }
};

// Usar no handleCreate:
const dimensionConfig = {
  ...GROUP_BY_TO_DIMENSION[groupBy],
  // Se for agrupamento temporal, usar campo correto para a métrica
  field: groupBy === 'month' 
    ? getDateFieldForMetric(metric) 
    : GROUP_BY_TO_DIMENSION[groupBy].field
};
```

---

## Fluxo Após a Correção

```text
Usuário cria visual "Faturamento por Mês":
1. Escolhe métrica: "Valor Total (R$)" → metric = 'revenue'
2. Escolhe agrupamento: "Por Mês" → groupBy = 'month'
3. Sistema detecta: revenue + month → usa 'won_at'
4. Visual salvo com dimension.field = 'won_at'
5. useVisualData filtra: won_at IS NOT NULL
6. Resultado: apenas negócios ganhos, agrupados por mês de vitória
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useVisualData.ts` | Corrigir `full_name` → `name` (linhas 88, 256) |
| `src/hooks/useVisualDrilldown.ts` | Corrigir `full_name` → `name` (linha 225) |
| `src/components/insights/AddVisualModal.tsx` | Adicionar lógica inteligente para campo de data baseado na métrica |

---

## Benefícios da Solução

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Criação de visual de faturamento | Usa created_at (errado) | Usa won_at automaticamente |
| Criação de visual de perdas | Usa created_at (errado) | Usa lost_at automaticamente |
| Query de responsáveis | Falha (coluna inexistente) | Funciona corretamente |
| Visuais futuros | Problema pode se repetir | Prevenido automaticamente |

---

## Sobre o Visual Existente

Após aplicar as correções de código, o visual atual ainda estará com a configuração errada (`created_at`). Há duas opções:

1. **Recriar o visual** — Depois das correções, deletar o visual atual e criar um novo "Faturamento por Mês" que já usará `won_at` automaticamente

2. **Corrigir via SQL** — Atualizar a configuração do visual existente:
```sql
UPDATE insights_visuals 
SET config = jsonb_set(config, '{dimension,field}', '"won_at"') 
WHERE title = 'Faturamento por Mês' 
  AND (config->>'dataSource') = 'deals';
```

