

## Alterar `update-deal-notes` para inserir no historico do negocio

Em vez de atualizar o campo `notes` do deal, a function vai inserir uma entrada do tipo `note` na tabela `deal_activities`, que e o historico exibido no painel lateral direito do negocio (conforme a imagem de referencia).

### O que muda

A Edge Function `update-deal-notes` sera reescrita para:

1. **Inserir** na tabela `deal_activities` em vez de fazer UPDATE na tabela `deals`
2. Criar um registro com:
   - `type`: `"note"`
   - `title`: `"Typeform"`
   - `content`: as anotacoes formatadas vindas do n8n
   - `deal_id`: o ID do negocio
   - `account_id`: da autenticacao
   - `user_id`: null (pois e uma insercao via API/integracao)

### Configuracao no n8n (sem alteracao)

A URL, metodo e body permanecem os mesmos:

| Campo | Valor |
|-------|-------|
| Method | PATCH |
| URL | `https://mtzoavtbtqflufyccern.supabase.co/functions/v1/update-deal-notes` |
| Body | `{ "deal_id": "...", "notes": "..." }` |
| Header | `Authorization: Bearer roy_sk_...` |

O parametro `append` deixa de ser necessario (sera ignorado se enviado).

### Resposta esperada

```json
{
  "success": true,
  "deal_id": "uuid",
  "activity_id": "uuid"
}
```

### Detalhes tecnicos

**Arquivo:** `supabase/functions/update-deal-notes/index.ts`

Alteracoes no codigo:

- Remover a logica de fetch + concatenacao de `deals.notes`
- Substituir por um `INSERT` na tabela `deal_activities` com os campos:
  - `account_id`: `auth.accountId`
  - `deal_id`: do body
  - `type`: `"note"`
  - `title`: `"Typeform"`
  - `content`: `notes` do body
  - `user_id`: `null`
- Manter validacao de UUID e autenticacao existentes
- Manter verificacao de que o deal existe e pertence a conta
- Retornar o `activity_id` criado na resposta

Nenhuma alteracao de schema ou config.toml necessaria -- a tabela `deal_activities` ja existe com todas as colunas necessarias e o tipo `note` ja e permitido.

