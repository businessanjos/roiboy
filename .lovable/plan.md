

## Corrigir busca de CPF/CNPJ na integração Omie

### Problema
A Edge Function `create-omie-os` busca o CPF/CNPJ apenas nos campos `client.cnpj` e `client.cpf` da tabela `clients`. Porém, neste caso, o CPF/CNPJ está armazenado como **campo personalizado do negócio** ("CPF ou CNPJ", ID: `de5d8543-287e-4ad9-917a-813d48d0d3eb`), na tabela `deal_field_values`. A função já busca os `dealFieldValues` (linha 129), mas nunca os consulta para extrair o CPF/CNPJ.

### Solução
Na etapa 5 (busca do cliente no Omie), antes de tentar `client.cnpj || client.cpf`, verificar se existe um valor no campo personalizado "CPF ou CNPJ" dentro dos `dealFieldValues`. Se existir, usá-lo como fonte primária.

### Alteração — `supabase/functions/create-omie-os/index.ts`

**Linhas 147-155**: Adicionar busca do CPF/CNPJ no campo personalizado do deal antes do fallback para o client record:

```typescript
// 5. Find client in Omie
let omieClient: any = null;

// Try CPF/CNPJ from deal custom field first (field "CPF ou CNPJ")
const CPF_CNPJ_FIELD_ID = 'de5d8543-287e-4ad9-917a-813d48d0d3eb';
const cpfCnpjFromDeal = (dealFieldValues || []).find(
  (v: any) => v.field_id === CPF_CNPJ_FIELD_ID
)?.value_text || '';

// Fallback to client record fields
const clientCpfCnpj = cpfCnpjFromDeal || client?.cnpj || client?.cpf || '';

if (clientCpfCnpj) {
  omieClient = await findOmieClientByCpfCnpj(appKey, appSecret, clientCpfCnpj);
}
```

Isso garante que o CPF/CNPJ preenchido no campo personalizado do negócio seja usado prioritariamente, com fallback para os campos nativos do cliente.

