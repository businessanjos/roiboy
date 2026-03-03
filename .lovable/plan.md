

## Problema

O campo "Cliente" no `OmieFieldMapper` permite ao usuário mapear para qualquer fonte (incluindo "Responsável do Negócio"). Se mapeado para `deal.responsible`, o nome do responsável é usado na busca de cliente no Omie — encontrando o cliente errado ou nenhum.

**O campo "Cliente" não deveria ser configurável pelo mapper.** A busca de cliente no Omie deve **sempre** usar CPF/CNPJ do cliente vinculado ao negócio, com fallback pelo nome do cliente. Isso é lógica fixa, não mapeável.

O campo "Vendedor", por sua vez, está funcionando corretamente na lógica (vai para `Observacoes`), mas o Omie espera o vendedor no campo `Cabecalho.cCodVend` ou em um campo específico — atualmente ele só aparece nas observações.

## Correção

### 1. Remover "Cliente" do mapeamento de campos
**Arquivo:** `src/components/integrations/OmieFieldMapper.tsx`
- Remover `{ key: "cliente", ... }` do array `OS_FIELDS` — a busca de cliente é sempre fixa por CPF/CNPJ.

### 2. Corrigir a busca de cliente na Edge Function
**Arquivo:** `supabase/functions/create-omie-os/index.ts`
- Na seção "Find client in Omie" (linhas 147-168), **ignorar** `fieldMappings.cliente` completamente.
- Sempre buscar por `client.cpf || client.cnpj` direto do objeto `client` do deal.
- Manter o fallback por `client.full_name`.

Código atual (problema):
```typescript
const clientCpfCnpj = resolveFieldValue(
  fieldMappings.cliente || { source: 'client.cpf_cnpj' },
  deal, client, dealFieldValues || [], responsibleUserName
);
```

Correção:
```typescript
const clientCpfCnpj = client?.cnpj || client?.cpf || '';
```

### 3. Redesplegar a Edge Function
Após a edição, redesplegar `create-omie-os`.

