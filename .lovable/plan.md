
## Corrigir card "Nao Compareceu" para usar o status correto

### Problema

O card "Nao Compareceu" usa a formula `participantes - check-ins (attendance)`, que retorna 19 (todos os participantes) porque nenhum registro existe na tabela `attendance`. O valor correto deveria ser **5**, que e a contagem de participantes com `rsvp_status = 'no_show'` na tabela `event_participants`.

### Solucao

Substituir a query da tabela `attendance` por uma query filtrada na tabela `event_participants` com `rsvp_status = 'no_show'`.

### Mudancas tecnicas

**Arquivo: `src/pages/EventDetail.tsx`**

1. **Alterar a query de attendance** (linhas 194-198): Substituir a busca na tabela `attendance` por uma contagem filtrada em `event_participants` com `rsvp_status = 'no_show'`:

```typescript
// Antes (incorreto):
const { count: attendanceCount } = await supabase
  .from("attendance")
  .select("*", { count: 'exact', head: true })
  .eq("event_id", id);

// Depois (correto):
const { count: noShowCount } = await supabase
  .from("event_participants")
  .select("*", { count: 'exact', head: true })
  .eq("event_id", id)
  .eq("rsvp_status", "no_show");
```

2. **Renomear o campo no state** (linhas 104, 207): Trocar `attendanceCount` por `noShowCount` no objeto `stats` e no `setStats`.

3. **Atualizar o card** (linha ~395): Exibir `stats.noShowCount` diretamente, sem calculo de subtracao.

O resultado: o card exibira **5** (participantes marcados como "Nao Compareceu"), consistente com o que aparece na aba Participantes.
