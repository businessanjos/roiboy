

## Exibir apenas o numero do dia nos visuais com sazonalidade "Diario"

### Problema

Quando a sazonalidade e "Diario", os eixos dos graficos exibem datas completas como "01/02/2026", "02/02/2026", etc., ocupando muito espaco e dificultando a leitura. O usuario quer ver apenas "01, 02, 03..." — os dados ja refletem o periodo filtrado (mensal ou anual), entao o contexto do mes/ano ja esta implicito.

### Mudancas

**1. `src/hooks/useVisualData.ts`** — Funcao `formatDateGroup` e `fillMissingDates`

- Alterar o case `'day'` de `format(date, 'dd/MM/yyyy')` para `format(date, 'dd')` (apenas o numero do dia com zero a esquerda)
- Atualizar `fillMissingDates` para usar o mesmo formato `'dd'` no case `'day'`

**2. `src/hooks/useStackedVisualData.ts`** — Funcao `getPeriodLabel`

- Alterar o default (day) para sempre retornar `format(date, 'dd')` — apenas o numero do dia, sem distincao de filtro multi-mes vs mono-mes (o filtro ja define o contexto)

### Comportamento esperado

| Sazonalidade | Label no eixo | Exemplo |
|-------------|---------------|---------|
| Diario | Apenas o dia | 01, 02, 03, ..., 28 |
| Semanal | Sem XX/MM | Sem 03/02 |
| Mensal | MMM/AA | Fev/26 |
| Anual | AAAA | 2026 |

Quando filtrado por mes (ex: Fev/2026), os dias 01-28 representam os dias daquele mes.
Quando filtrado por ano, os dias representam a soma de todos os dias (01 = dia 1 de todos os meses somados).

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `useVisualData.ts` | `formatDateGroup` day case: `'dd'`; `fillMissingDates` day case: `'dd'` |
| `useStackedVisualData.ts` | `getPeriodLabel` day case: `format(date, 'dd')` |
| `useVisualDrilldown.ts` | `formatDateGroup` day case: `'dd'` (manter consistencia) |
