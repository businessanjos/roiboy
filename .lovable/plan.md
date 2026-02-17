

## Corrigir redirecionamento do nome do Lead na pagina do Cliente

### Causa raiz

O problema esta no arquivo `src/components/client/ClientDeals.tsx`. Quando o usuario abre os detalhes de um negocio a partir da pagina do cliente, o componente converte os dados do negocio para o formato esperado pelo `DealDetailSheet`. Nessa conversao (linha 274), o `lead_id` esta **fixado como `null`**:

```
lead_id: null,  // <-- problema: ignora o lead_id real do negocio
```

Isso faz com que o `DealDetailSheet` nunca encontre um `lead_id` e sempre caia no fallback para `client_id`, redirecionando para a pagina do cliente.

### Mudancas

**Arquivo:** `src/components/client/ClientDeals.tsx`

1. Adicionar `lead_id` na interface local `Deal` (linha 43-65):
   - Adicionar `lead_id: string | null;`

2. Na conversao do deal para o sheet (linha 274):
   - Trocar `lead_id: null` por `lead_id: deal.lead_id ?? null`
   - Isso usa o `lead_id` real vindo do banco de dados

### Resultado

Quando o usuario clicar no nome do contato nos detalhes do negocio (aberto a partir da pagina do cliente), o sistema ira:
- Redirecionar para `/leads?lead={lead_id}` se houver lead vinculado
- Redirecionar para `/clients/{client_id}` apenas como fallback

