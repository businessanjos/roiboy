

## Correção: Valores fixos de endereço para cadastro automático no Omie

### Problema

Quando o campo "Cidade" do negócio está vazio ou não tem dados suficientes, os campos `cidade`, `estado` e `cep` ficam como strings vazias `''`, e o Omie rejeita o cadastro exigindo todos os campos de endereço preenchidos.

### Solução

Alterar os fallbacks em `createOmieClient` para usar valores placeholder fixos em vez de strings vazias:

**Arquivo: `supabase/functions/create-omie-os/index.ts`** (linhas 118-123)

```typescript
endereco: clientData.street || 'A definir',
endereco_numero: clientData.streetNumber || 'S/N',
bairro: clientData.neighborhood || 'A definir',
cidade: clientData.city || 'A definir',
estado: clientData.state || 'SP',
cep: clientData.zipCode?.replace(/\D/g, '') || '00000000',
```

- `estado` usa `'SP'` como fallback pois o Omie exige UF válida de 2 letras
- `cep` usa `'00000000'` como placeholder genérico
- Os demais usam `'A definir'` para sinalizar que precisam de atualização manual

Após o deploy, o cadastro será criado com sucesso e o funcionário poderá corrigir os dados diretamente no painel do Omie.

### Arquivo alterado
- `supabase/functions/create-omie-os/index.ts`

