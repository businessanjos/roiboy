

## Adicionar card "Vencidos" no Dashboard de Gestão

### O que sera feito

Adicionar um novo card "Vencidos" na linha de status do Dashboard de Gestão (Operações), mostrando a contagem de contratos que estão com status "active" mas cuja data de término (`end_date`) já passou. Atualmente existem 5 contratos nessa situação.

### Alterações necessárias

**1. Banco de dados -- Atualizar a função RPC `get_dashboard_contract_counts`**

Adicionar o campo `expired` na resposta da função, contando contratos onde `status = 'active' AND end_date < CURRENT_DATE`:

```sql
'expired', COUNT(*) FILTER (WHERE status = 'active' AND end_date IS NOT NULL AND end_date < CURRENT_DATE)
```

**2. Hook `src/hooks/useDashboardContractStats.ts`**

Adicionar `expired: number` na interface `ContractStats`.

**3. Dashboard `src/pages/Dashboard.tsx`**

- Alterar o grid de `md:grid-cols-5` para `md:grid-cols-6` para acomodar o novo card
- Adicionar o card "Vencidos" após "Congelamentos", com borda vermelha-alaranjada e ícone `Clock` (ou `Timer`), exibindo `contractStats?.expired ?? 0`

### Detalhes técnicos

- "Vencidos" não é um status explícito na tabela; é derivado de `status = 'active'` + `end_date < hoje`
- Esses contratos continuam contando como "Ativos" no card de Ativos (comportamento atual mantido). O card "Vencidos" é uma métrica adicional de alerta
- A contagem vem direto da RPC, sem carga extra no frontend
