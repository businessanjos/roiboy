

## Correção: Filtro de data ignora fuso horário

### Problema
O `won_at` é armazenado em UTC. Ao fazer `.split("T")[0]`, extraímos a data UTC, não a data local. Um negócio ganho às 22h no Brasil (UTC-3) tem `won_at = "2026-02-28T01:00:00Z"` mas na realidade foi ganho dia 27/02 no horário local -- ou o inverso: ganho às 23h de 28/02 local vira `2026-03-01T02:00:00Z`, que o filtro interpreta como março, excluindo do período de fevereiro.

Isso explica os 2-3 negócios faltando consistentemente.

### Solução
Converter o timestamp UTC para data local antes de comparar:

```typescript
const getDateField = (deal: any): string => {
  let raw: string | null = null;
  if (filterStatus === "won") raw = deal.won_at;
  else if (filterStatus === "lost") raw = deal.lost_at;
  else raw = deal.created_at;
  
  if (!raw) return "";
  // Converter UTC para data local
  const d = new Date(raw);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
```

Ao usar `new Date(raw)` e extrair com `.getFullYear()/.getMonth()/.getDate()`, o JavaScript converte automaticamente para o fuso horário local do navegador.

### Arquivo afetado
- `src/components/sales/PipelineExportDialog.tsx` -- linhas 334-338 (função `getDateField`)

