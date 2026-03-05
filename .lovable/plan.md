

## Correção: Filtro de data na exportação usa campo errado

### Problema
O filtro de datas (linhas 334-345) **sempre** usa `created_at` para filtrar, independente do status selecionado. Quando o usuário filtra por "Ganhas" entre 01/02 e 28/02, negócios que foram **criados** antes de fevereiro mas **ganhos** em fevereiro são excluídos da exportação. Por isso retornaram 30 em vez de 33.

### Solução
Ajustar o filtro de data para usar o campo correto conforme o status:
- **Status "won"**: filtrar por `won_at`
- **Status "lost"**: filtrar por `lost_at`
- **Qualquer outro**: filtrar por `created_at`

```typescript
// Determinar qual campo de data usar baseado no filtro de status
const getDateField = (deal: any): string => {
  if (filterStatus === "won") return (deal.won_at || "").split("T")[0];
  if (filterStatus === "lost") return (deal.lost_at || "").split("T")[0];
  return (deal.created_at || "").split("T")[0];
};

if (filterDateFrom) {
  filtered = filtered.filter((d) => getDateField(d) >= filterDateFrom);
}
if (filterDateTo) {
  filtered = filtered.filter((d) => getDateField(d) <= filterDateTo);
}
```

### Arquivo afetado
- `src/components/sales/PipelineExportDialog.tsx` — linhas 333-345

