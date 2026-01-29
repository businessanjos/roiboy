
# Plano: Reverter Filtro "Ativo" para Status Apenas

## Alteração a Fazer

Reverter a lógica do filtro "Ativo" para considerar apenas contratos com `status === "active"`, removendo a verificação de data de término.

## Arquivo a Modificar

**supabase/functions/list-clients/index.ts**

## Alteracao

**De (linhas 276-285):**
```typescript
} else if (contractFilter === "active") {
  // Filter by contract status = active OR future end date (regardless of status)
  filteredClients = filteredClients.filter(c => {
    if (!c.contract) return false;
    const endDate = c.contract.end_date;
    if (c.contract.status === "active") return true;
    if (endDate && new Date(endDate) >= new Date()) return true;
    return false;
  });
} else {
```

**Para:**
```typescript
} else if (contractFilter === "active") {
  // Filter by contract status = active only
  filteredClients = filteredClients.filter(c => c.contract?.status === "active");
} else {
```

## Resultado

O filtro "Ativo" retornara apenas clientes cujo contrato tem `status = "active"`, ignorando contratos com outros status mesmo que tenham data de termino futura.
