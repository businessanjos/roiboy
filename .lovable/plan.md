

## Diagnóstico: Bug de Fuso Horário nas Datas de Tarefas

### Causa Raiz Confirmada

O problema está na **exibição**, não no armazenamento. Os dados no banco estão **corretos** — as tarefas marcadas para 03/03 têm `due_date = '2026-03-03'` no banco.

O bug ocorre porque o código usa `new Date("2026-03-03")`, que o JavaScript interpreta como **UTC meia-noite**. No fuso horário do Brasil (UTC-3), isso vira **02/03 às 21:00**, fazendo a data aparecer como dia 02 em vez de dia 03.

O projeto já possui a função `parseLocalDate()` em `src/lib/dateUtils.ts` que resolve exatamente esse problema, mas ela **não está sendo usada consistentemente**.

### Arquivos Afetados (Tarefas)

Os seguintes arquivos usam `new Date(task.due_date)` incorretamente e precisam ser corrigidos para usar `parseLocalDate()`:

1. **`src/pages/Tasks.tsx`** — 3 ocorrências (linhas 447, 570, 636):
   - `getDueDateInfo()` — exibe a data na tabela
   - `getDuePriority()` — ordena por data
   - Cálculo de overdue count

2. **`src/components/sales/DealActivitiesTab.tsx`** — provável ocorrência similar
3. **`src/components/sales/DealActivitiesDialog.tsx`** — provável ocorrência similar
4. **`src/hooks/useDealActivityStatus.ts`** — já usa `new Date(t.due_date + "T00:00:00")` como workaround (funciona, mas inconsistente)
5. **`src/components/marketing/tasks/MarketingTaskRow.tsx`** — usa `new Date(task.due_date)` na linha do `dueDate`
6. **`src/components/marketing/tasks/MarketingTaskDialog.tsx`** — usa `new Date(existingTask.due_date)`

### Correção

Substituir todas as ocorrências de `new Date(task.due_date)` por `parseLocalDate(task.due_date)` nos componentes de tarefas listados, garantindo que datas no formato `YYYY-MM-DD` sejam interpretadas como **horário local** e não UTC.

A função `parseLocalDate` já existe e faz exatamente isso:
```typescript
// new Date("2026-03-03") → UTC midnight → 02/03 21:00 BRT ❌
// parseLocalDate("2026-03-03") → local midnight → 03/03 00:00 BRT ✅
```

### Escopo da Correção

Focarei nos componentes de **tarefas** que o usuário reportou. Os componentes financeiros (`FinancialBoletosPage`, `CashFlow`, etc.) provavelmente têm o mesmo bug, mas serão tratados separadamente se necessário.

