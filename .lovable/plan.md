
## Correção: Datas dos Momentos CX adiantadas em 1 dia no Dashboard

### Diagnóstico

No arquivo `src/hooks/useDashboardData.tsx`, linha 238, a data do evento é parseada com `new Date(event.event_date)`. Como `event_date` é uma string no formato `YYYY-MM-DD`, o JavaScript interpreta isso como **UTC meia-noite**. No fuso horário do Brasil (UTC-3), isso vira o dia anterior às 21h, fazendo com que o cálculo de `daysUntil` fique adiantado em 1 dia.

O componente do perfil do cliente (`ClientLifeEvents.tsx`) já usa `parseLocalDate` corretamente (linha 531), mas o Dashboard não segue o mesmo padrão.

### Causa raiz

`new Date("2026-02-12")` cria `2026-02-12T00:00:00Z` (UTC), que no Brasil é `2026-02-11T21:00:00` -- ou seja, dia 11 em vez de dia 12. Isso faz eventos de amanhã aparecerem como "Hoje!".

### Solução

**Arquivo:** `src/hooks/useDashboardData.tsx`

Substituir `new Date(event.event_date)` por `parseLocalDate(event.event_date)` na linha 238, usando o utilitário que já existe no projeto (`src/lib/dateUtils.ts`). Adicionar o import de `parseLocalDate` no topo do arquivo.

Alteração de 2 linhas: um import e a substituição da chamada de parse.
