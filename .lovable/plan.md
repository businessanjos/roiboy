

## Correção: Erro "Tag [APENAS_IMPORTACAO_API]" na busca de contas Omie

### Problema
A API do Omie rejeita o parâmetro `apenas_importacao_api` no endpoint `ListarContasCorrentes` — ele não faz parte da estrutura aceita por esse método.

### Correção
Remover o parâmetro inválido do payload em `supabase/functions/list-omie-accounts/index.ts`, deixando apenas `pagina` e `registros_por_pagina`:

```typescript
param: [{ pagina: 1, registros_por_pagina: 50 }],
```

Mudança de uma única linha. Após a correção, re-deploy automático da edge function.

