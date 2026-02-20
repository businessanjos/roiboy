
## Adicionar campo "Dominio" na integracao 3C Plus

### Resumo

Adicionar um campo de dominio personalizado na tela de configuracao do 3C Plus (Configuracoes > Integracoes > 3C Plus). O dominio sera salvo no campo `metadata` da tabela `user_integrations` e utilizado como URL de fallback quando a chamada via API falhar, em vez do dominio generico `https://app.3c.fluxoti.com`.

### Alteracoes

#### 1. Frontend - `src/components/integrations/IntegrationsContent.tsx`

- Adicionar estado `threeCPlusDomain` para o campo de dominio
- Adicionar campo de input "Dominio" na secao de configuracao do 3C Plus (tanto no formulario de conexao quanto na visualizacao de conectado)
- Enviar o dominio junto com o token na chamada para `threecplus-auth`
- Ao carregar a integracao existente, popular o campo de dominio a partir do `metadata`
- Permitir editar o dominio mesmo depois de conectado

O campo ficara abaixo do campo "Token da API" com placeholder `https://suaempresa.3c.plus/login` e uma descricao explicativa.

#### 2. Edge Function - `supabase/functions/threecplus-auth/index.ts`

- Receber o campo `domain` no body da requisicao
- Salvar o dominio no campo `metadata` junto com o `user_name`:
  ```
  metadata: { user_name: userName, domain: domain }
  ```

#### 3. Edge Function - `supabase/functions/threecplus-call/index.ts`

- Buscar tambem o campo `metadata` ao consultar a integracao do usuario
- Usar o dominio do metadata como `fallback_url` quando a chamada API falhar, em vez do generico `https://app.3c.fluxoti.com`

#### 4. Frontend - `src/components/sales/ThreeCPlusCallButton.tsx`

- Usar o `fallback_url` retornado pela edge function (que agora contera o dominio personalizado do usuario)

### Nenhuma migracao de banco necessaria

O campo `metadata` (JSON) ja existe na tabela `user_integrations` e comporta dados adicionais sem alteracao de schema.
