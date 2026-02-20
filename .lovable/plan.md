

## Botao de ligacao 3C Plus no detalhe do negocio

### Resumo

Adicionar um botao com icone de telefone no header do `DealDetailSheet` (ao lado do numero de telefone do contato). Ao clicar, o sistema verifica se o usuario tem uma integracao 3C Plus ativa e abre a plataforma 3C Plus em uma nova aba para iniciar a ligacao.

### Abordagem

A plataforma 3C Plus e um discador web. O agente precisa estar logado na plataforma para realizar ligacoes. A forma mais confiavel de integrar e:

1. Verificar se o usuario possui integracao 3C Plus (token salvo em `user_integrations`)
2. Abrir a plataforma 3C Plus (`https://app.3c.fluxoti.com`) em uma nova aba
3. Simultaneamente, chamar a Edge Function para tentar iniciar a chamada via API usando o endpoint de click-to-call do agente

### Alteracoes tecnicas

#### 1. Nova Edge Function `supabase/functions/threecplus-call/index.ts`

Funcao que recebe `phone` (numero E.164 do lead) e:
- Busca o `access_token` do usuario logado na tabela `user_integrations` (provider = `3cplus`)
- Se nao encontrar, retorna erro "Integracao 3C Plus nao configurada"
- Tenta fazer uma chamada click-to-call via API 3C Plus:
  - `POST https://app.3c.fluxoti.com/api/v1/agent/click_to_call?api_token={token}` com `{ "phone": "5511999999999" }`
- Retorna o resultado (sucesso ou erro) e a URL do app 3C Plus para fallback

#### 2. Componente `src/components/sales/ThreeCPlusCallButton.tsx` (novo)

Botao reutilizavel que:
- Recebe `contactPhone` e `contactName` como props
- Ao clicar, chama a edge function `threecplus-call`
- Se o usuario nao tem integracao, mostra toast com link para configurar
- Se a chamada via API funcionar, mostra toast de sucesso
- Como fallback, abre a plataforma 3C Plus em nova aba
- Exibe tooltip "Ligar via 3C Plus"

#### 3. Integracao no `DealDetailSheet.tsx`

Adicionar o `ThreeCPlusCallButton` ao lado do numero de telefone no header do deal detail:

```text
[Avatar] [Titulo do Negocio] [Badge Status]
         [Nome do Contato] . [Telefone] [Copiar] [Botao 3C Plus]
```

O botao so aparece quando `contactPhone` existe.

#### 4. Registro em `supabase/config.toml`

```toml
[functions.threecplus-call]
verify_jwt = false
```

### Fluxo do usuario

```text
1. Usuario abre o detalhe de um negocio no pipeline
2. Ve o botao de telefone ao lado do numero do contato
3. Clica no botao
4. Sistema verifica se o usuario tem 3C Plus conectado
   4a. Se NAO: toast "Configure sua integracao 3C Plus em Configuracoes > Integracoes"
   4b. Se SIM: tenta iniciar chamada via API
       - Se a API aceitar: toast "Chamada iniciada no 3C Plus"
       - Se falhar: abre o app 3C Plus em nova aba com toast informativo
5. O agente gerencia a chamada diretamente na plataforma 3C Plus
```

### Arquivos envolvidos

- **Novo:** `supabase/functions/threecplus-call/index.ts` - Edge function para iniciar chamada
- **Novo:** `src/components/sales/ThreeCPlusCallButton.tsx` - Componente do botao
- **Editar:** `src/components/sales/DealDetailSheet.tsx` - Adicionar botao no header
- **Editar:** `supabase/config.toml` - Registrar nova edge function

