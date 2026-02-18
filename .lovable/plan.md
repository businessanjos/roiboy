

## Corrigir erro de constraint ao mesclar clientes

### Problema

Ao mesclar dois clientes, o passo 1 tenta atualizar o telefone do cliente destino com o valor escolhido. Porem, o cliente origem ainda existe no banco com o mesmo telefone, violando a constraint unica `clients_account_id_phone_e164_key` (account_id + phone_e164).

### Causa raiz

A ordem das operacoes esta incorreta:
1. Atualiza o destino (com telefone que pode conflitar) -- FALHA AQUI
2. Transfere dados
3. Deleta a origem

### Solucao

Adicionar um **passo 0** que neutraliza o telefone do cliente origem antes de qualquer atualizacao no destino. Isso remove o conflito de unicidade.

### Mudanca tecnica

**Arquivo: `src/hooks/useClientMerge.ts`**

Inserir antes do passo 1 (update do target) o seguinte bloco:

```typescript
// Step 0: Neutralize source client phone to avoid unique constraint conflict
const { error: neutralizeError } = await supabase
  .from("clients")
  .update({ phone_e164: `+0000${Date.now()}` })
  .eq("id", sourceClientId)
  .eq("account_id", currentUser.account_id);

if (neutralizeError) throw neutralizeError;
```

Isso define o telefone da origem para um valor temporario unico, liberando a constraint para que o update do destino funcione. O cliente origem sera deletado logo depois no passo 20, entao esse valor temporario nunca sera visivel.

### Resultado

- A mesclagem funciona mesmo quando o telefone escolhido conflita com o da origem
- Nenhuma mudanca visivel para o usuario
- O fluxo continua exatamente como antes apos a neutralizacao
