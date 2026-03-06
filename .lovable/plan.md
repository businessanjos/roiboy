

## Diagnóstico: Erro "contribuinte deve ser 'S' ou 'N'"

### Problema

A API do Omie rejeita o valor `'2'` para o campo `contribuinte` na criação automática de clientes. O código atual na linha 100 de `create-omie-os/index.ts` define:

```typescript
contribuinte: '2',
```

A API espera apenas `'S'` (contribuinte de ICMS) ou `'N'` (não contribuinte). O valor `'2'` era aceito em versões antigas da API mas foi descontinuado.

### Correção

**`supabase/functions/create-omie-os/index.ts`** — linha 100:

Alterar `contribuinte: '2'` para `contribuinte: 'N'`. Para prestadores de serviço (que é o caso de OS), o valor correto é `'N'` (não contribuinte de ICMS). Se for pessoa jurídica contribuinte, o padrão `'N'` ainda é o mais seguro para auto-cadastro.

### Arquivo alterado
- `supabase/functions/create-omie-os/index.ts`

