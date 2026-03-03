

## Bug: "Ganhos" no funil ignora filtros de campos personalizados

### Problema
O funil busca os dados das etapas regulares via `fetchDealsData`, que aplica os filtros `leadFieldFilter` e `dealFieldFilter` (Canal, Origem da Venda, etc.). Porém, a contagem de "Ganhos" (linhas 91-113 de `useVisualData.ts`) é uma query **separada** que conta diretamente na tabela `deals` com `status = 'won'`, aplicando apenas filtros de data e usuário — **ignorando completamente** os filtros de campos personalizados do Lead e do Negócio.

Isso explica por que "Ganhos" mostra 78 enquanto a etapa anterior (Follow Up) mostra apenas 17.

### Solução
Em vez de fazer uma query separada para "Ganhos", reutilizar os deals já filtrados (`filteredData`) que passaram por `filterByLeadField` e `filterByDealField`, e contar quantos têm `status === 'won'`.

### Alteração — `src/hooks/useVisualData.ts`

**Bloco do funil (linhas ~77-113)**: Após o sort por `display_order`, em vez de fazer uma nova query ao banco para contar won deals, calcular a contagem diretamente dos deals já filtrados:

```typescript
// Instead of a separate won query:
const wonCount = filteredData.filter(d => d.status === 'won').length;
result.push({
  name: 'Ganhos',
  value: wonCount,
  color: '#10b981',
});
```

Isso exige mover a lógica de append "Ganhos" para **depois** da aplicação dos filtros dentro de `fetchDealsData`, ou passar os filtros para o bloco do funil no hook principal. A abordagem mais limpa é fazer `fetchDealsData` retornar a contagem de won como parte do resultado quando `chartType === 'funnel'`, já que ela já tem acesso ao `filteredData` completo.

**Mudança concreta**: No `fetchDealsData`, quando chamado para funil com `stage_name`, após filtrar e agregar, anexar "Ganhos" contando `filteredData.filter(d => d.status === 'won').length`. Remover a query separada de won do hook principal (linhas 91-113).

