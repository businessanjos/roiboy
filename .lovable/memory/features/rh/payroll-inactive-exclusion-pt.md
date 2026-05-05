---
name: HR Payroll Inactive Exclusion
description: Colaboradores com status `inactive` (Desligado) são sempre excluídos das exportações e cálculos de folha, mesmo que apareçam nos filtros de tela. Status `vacation` e `leave` continuam na folha.
type: feature
---

Regra aplicada em `src/pages/rh/components/payrollExport.ts` via `filterPayrollEligible(collabs)` antes de `recalcDerived`. Independente do filtro de status escolhido pelo usuário na tabela `/rh/collaborators`, qualquer registro com `status='inactive'` é removido do CSV/XLSX e dos totais de Folha & Encargos.

Status mantidos no cálculo (continuam custando até o real desligamento):
- `active`
- `vacation` (Férias)
- `leave` (Afastado)

UI: o dropdown de exportação exibe um aviso explicando essa regra para evitar surpresa quando o usuário filtra "Todos" e ainda assim os desligados não aparecem.
