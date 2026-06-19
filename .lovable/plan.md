## Objetivo
Quando `create-lead` recusar um lead por duplicidade (HTTP 409), gravar o payload recebido + qual lead já existia, pra você auditar de onde vêm as duplicatas (qual webhook/integração está reenviando os mesmos contatos).

## Diagnóstico atual
Os 3 eventos de 16/06 vieram com user-agent `Deno/SupabaseEdgeRuntime` — ou seja, outra Edge Function nossa chamou `create-lead`. Os logs do Edge Runtime já expiraram, então hoje não dá pra reconstruir o payload. Precisamos persistir.

## Implementação

### 1. Nova tabela `lead_duplicate_attempts`
Migration com:
- `id uuid pk`
- `account_id uuid` (FK accounts)
- `existing_lead_id uuid` (FK leads, nullable se já tiver sido apagado)
- `existing_lead_name text`
- `matched_field text` (`phone` | `email` futuramente)
- `matched_value text` (telefone/email normalizado que bateu)
- `payload jsonb` (corpo cru recebido)
- `auth_method text` (`api_key` | `jwt` | `legacy`)
- `api_key_id uuid` (nullable)
- `ip_address text`
- `user_agent text`
- `created_at timestamptz default now()`
- Index em `account_id, created_at desc` e `existing_lead_id`
- RLS: SELECT para `authenticated` da própria `account_id` (via `get_user_account_id`); INSERT/ALL para `service_role`
- GRANT `SELECT, INSERT, UPDATE, DELETE` para `authenticated`, `ALL` para `service_role`

### 2. Atualizar `supabase/functions/create-lead/index.ts`
No bloco que retorna 409 (após o `if (existing)`), antes do `return`:
- Inserir registro em `lead_duplicate_attempts` com:
  - `payload` = corpo recebido
  - `matched_field: 'phone'`, `matched_value: normalizedPhone`
  - `existing_lead_id`, `existing_lead_name` = `existing`
  - `ip_address` = `req.headers.get('x-forwarded-for')`
  - `user_agent` = `req.headers.get('user-agent')`
  - `auth_method`, `api_key_id` do `auth`
- Falha de log não bloqueia a resposta (try/catch).

### 3. (Opcional, mesma estrutura) Cobrir também duplicidade por email
Hoje o 409 só dispara por telefone. Não vou ampliar o critério agora — só registro o que já existe. Se quiser, abro outra task pra checar duplicidade por email também.

## Como você vai usar
Por ora, consulta direta via SQL (`select * from lead_duplicate_attempts order by created_at desc`). Se quiser uma tela em `/settings` ou em Leads listando isso, me diga depois — fica fora desse plano.

## Arquivos afetados
- `supabase/migrations/<timestamp>_lead_duplicate_attempts.sql` (novo)
- `supabase/functions/create-lead/index.ts` (edit no bloco do 409)