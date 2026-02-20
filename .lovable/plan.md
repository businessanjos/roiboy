

## Corrigir upsert na Edge Function threecplus-auth

### Causa raiz

Os logs mostram o erro:

```
Could not find the 'account_id' column of 'user_integrations' in the schema cache
```

A edge function `threecplus-auth` tenta fazer upsert com os campos `account_id` e `user_name`, mas a tabela `user_integrations` nao possui essas colunas.

Colunas existentes na tabela: `id`, `user_id`, `provider`, `access_token`, `refresh_token`, `expires_at`, `metadata`, `created_at`, `updated_at`, `user_email`.

### Correcao

Remover `account_id` e `user_name` do objeto de upsert na edge function. Opcionalmente, salvar o `user_name` no campo `metadata` (JSON) que ja existe na tabela.

### Alteracao no arquivo `supabase/functions/threecplus-auth/index.ts`

O upsert atual:
```typescript
{
  user_id: userData.id,
  provider: "3cplus",
  access_token: api_token.trim(),
  user_email: userEmail,
  user_name: userName,       // NAO EXISTE na tabela
  account_id: userData.account_id,  // NAO EXISTE na tabela
}
```

Corrigido:
```typescript
{
  user_id: userData.id,
  provider: "3cplus",
  access_token: api_token.trim(),
  user_email: userEmail,
  metadata: { user_name: userName },
}
```

### Arquivos envolvidos

- **Editar:** `supabase/functions/threecplus-auth/index.ts` - Remover campos inexistentes do upsert
