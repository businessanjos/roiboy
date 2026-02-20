

## Integrar 3C Plus - Login na aba Integracoes

### Resumo

Adicionar uma nova aba "3C Plus" nas configuracoes de Integracoes do ROY, permitindo que o usuario faca login com seu token de API da 3C Plus. O sistema validara o token chamando a API da 3C Plus e armazenara as credenciais na tabela `user_integrations`.

### Como funciona a autenticacao da 3C Plus

A 3C Plus utiliza autenticacao por API Token (nao OAuth). O usuario fornece seu token e o sistema valida chamando o endpoint `user/me` na API `https://app.3c.fluxoti.com/api/v1/`.

### Alteracoes tecnicas

#### 1. Edge Function `supabase/functions/3cplus-auth/index.ts` (nova)

Funcao que recebe o token do usuario, valida contra a API da 3C Plus e armazena na tabela `user_integrations`:

- Recebe `{ api_token }` no body + Authorization header do usuario logado
- Chama `GET https://app.3c.fluxoti.com/api/v1/user/me` com o token para validar
- Se valido, faz upsert em `user_integrations` com provider `3cplus`, armazenando o token e dados do usuario (nome, email)
- Retorna os dados do usuario da 3C Plus

#### 2. Frontend `src/components/integrations/IntegrationsContent.tsx`

**Adicionar na lista de integracoes:**
```
{ id: "3cplus", name: "3C Plus", description: "Plataforma de telefonia cloud para call center", icon: Phone }
```

**Nova aba "3C Plus"** no TabsList, com icone `Phone` do lucide-react.

**Conteudo da aba:**
- Card com formulario de login contendo um campo para o API Token
- Botao "Conectar" que chama a edge function `3cplus-auth`
- Ao conectar com sucesso, exibe os dados do usuario 3C Plus (nome/email) com opcao de desconectar
- Badge de status (Conectado/Desconectado) no header do card

**Logica de desconectar:** reutiliza a funcao `handleDisconnect` existente com provider `"3cplus"`.

#### 3. Fluxo do usuario

```text
1. Usuario acessa Configuracoes > Integracoes > aba "3C Plus"
2. Ve card "Conexao 3C Plus" com campo para API Token
3. Cola seu token e clica "Conectar"
4. Edge function valida o token na API da 3C Plus
5. Se valido: salva em user_integrations, exibe "Conectado como [nome/email]"
6. Se invalido: exibe erro "Token invalido"
7. Para desconectar: botao "Desconectar" remove o registro
```

### Arquivos envolvidos

- **Novo:** `supabase/functions/3cplus-auth/index.ts` - Edge function de validacao
- **Editar:** `src/components/integrations/IntegrationsContent.tsx` - Nova aba e formulario
- **Editar:** `supabase/config.toml` - Registro da nova edge function (verify_jwt = false)

