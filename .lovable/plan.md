

## Corrigir Filtro de Contratos no Dashboard de Gestao

### Problema

O codigo corrigido anteriormente esta com a logica correta para contar novos/cancelamentos/encerramentos, **porem o filtro `filteredContractData` esta eliminando contratos antes de chegar ao calculo**.

O filtro atual (linhas 265-274) escolhe **uma unica data** por contrato para verificar se esta no periodo:
- Se tem `cancelled_at`, usa apenas essa data
- Senao, usa `start_date`

Isso causa dois problemas:
1. Um contrato iniciado em agosto e cancelado em janeiro: o filtro usa `cancelled_at` (janeiro), entao ele **nao aparece como "novo" em agosto**
2. Contratos ativos antigos (sem `cancelled_at`, com `start_date` fora do periodo): sao **completamente excluidos**, embora ainda sejam relevantes para contexto

### Solucao

Alterar o filtro para incluir um contrato se **qualquer** uma de suas datas relevantes cair dentro do periodo selecionado.

### Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Dashboard.tsx` | Corrigir logica do `filteredContractData` (linhas 265-274) |

### Detalhes tecnicos

**Substituir** a logica atual do filtro por:

```typescript
return contractData.filter(contract => {
  // Include contract if ANY relevant date falls within the period
  const startDate = contract.start_date ? parseISO(contract.start_date) : null;
  const exitDate = contract.cancelled_at 
    ? parseISO(contract.cancelled_at)
    : contract.status_changed_at
      ? parseISO(contract.status_changed_at)
      : null;

  const startInPeriod = startDate && startDate >= periodStart && startDate <= periodEnd;
  const exitInPeriod = exitDate && exitDate >= periodStart && exitDate <= periodEnd;

  if (!startInPeriod && !exitInPeriod) return false;

  // Filter by product
  if (gestaoProductFilter !== "all") {
    const clientProducts = clientProductsMap[contract.client_id] || [];
    if (!clientProducts.includes(gestaoProductFilter)) return false;
  }

  return true;
});
```

Com essa correcao, um contrato que iniciou em agosto e foi cancelado em janeiro aparecera no `filteredContractData` em ambos os contextos: sera contado como "novo" em agosto E como "cancelamento" em janeiro, refletindo os dados reais do banco.

