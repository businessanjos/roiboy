

## Corrigir click-to-call com selecao de campanha e dominio dinamico

### Problemas identificados

1. **URL da API incorreta**: O codigo usa `app.3c.fluxoti.com` fixo, mas o dominio correto e `anjosbusiness.3c.plus`
2. **Endpoint errado**: O codigo chama `/api/v1/agent/click_to_call` que nao existe na API do 3C Plus. O endpoint correto e `/api/v1/click2call`
3. **Sem selecao de campanha**: O agente precisa estar logado em uma campanha para o click-to-call funcionar. A API oferece `GET /agent/campaigns` para listar campanhas e `POST /agent/login` para logar em uma

### Solucao

Criar um fluxo onde:
1. Ao clicar no botao de ligar, o sistema busca as campanhas disponiveis do agente
2. Se houver mais de uma, mostra um dialog para o usuario selecionar
3. O sistema faz login na campanha selecionada e dispara o click-to-call
4. Tudo usando o dominio personalizado configurado nas integracoes

### Alteracoes

#### 1. Nova Edge Function - `supabase/functions/threecplus-campaigns/index.ts`

Criar edge function para listar as campanhas disponiveis do agente:
- Buscar o token e metadata (dominio) da integracao do usuario
- Chamar `GET {dominio}/api/v1/agent/campaigns?api_token=...`
- Retornar a lista de campanhas para o frontend

#### 2. Atualizar Edge Function - `supabase/functions/threecplus-call/index.ts`

- Receber `campaign_id` no body da requisicao (opcional)
- Extrair o dominio base do `metadata.domain` (removendo `/login` se presente)
- Se `campaign_id` fornecido, fazer login na campanha via `POST {dominio}/api/v1/agent/login?api_token=...` com body `{ campaign_id }`
- Chamar o endpoint correto: `POST {dominio}/api/v1/click2call?api_token=...` com body `{ phone }`
- Se falhar, retornar mensagem clara e fallback_url com o dominio correto

#### 3. Atualizar Frontend - `src/components/sales/ThreeCPlusCallButton.tsx`

- Ao clicar no botao, primeiro buscar campanhas via `threecplus-campaigns`
- Se houver apenas uma campanha, usar diretamente
- Se houver multiplas, abrir um Dialog/Popover para o usuario selecionar
- Enviar `campaign_id` e `phone` para `threecplus-call`
- Melhorar mensagens de erro e feedback visual

### Detalhes tecnicos

#### Endpoints 3C Plus utilizados

| Endpoint | Metodo | Descricao |
|---|---|---|
| `/api/v1/agent/campaigns` | GET | Lista campanhas do agente |
| `/api/v1/agent/login` | POST | Loga agente em campanha |
| `/api/v1/click2call` | POST | Inicia ligacao manual |

#### Fluxo da chamada

1. Usuario clica no botao de telefone
2. Frontend chama `threecplus-campaigns` para listar campanhas
3. Se multiplas campanhas: mostra seletor. Se uma: usa direto
4. Frontend chama `threecplus-call` com `{ phone, campaign_id }`
5. Edge function faz login na campanha e depois click2call
6. Retorna sucesso ou erro com fallback para o dominio do usuario

#### Construcao do dominio base

```text
Input:  "https://anjosbusiness.3c.plus/login"
Output: "https://anjosbusiness.3c.plus"

Input:  null (sem dominio configurado)
Output: "https://app.3c.fluxoti.com" (fallback)
```

### Arquivos envolvidos

- **Criar:** `supabase/functions/threecplus-campaigns/index.ts` - Nova edge function para listar campanhas
- **Editar:** `supabase/functions/threecplus-call/index.ts` - Corrigir endpoint, usar dominio dinamico, aceitar campaign_id
- **Editar:** `src/components/sales/ThreeCPlusCallButton.tsx` - Adicionar selecao de campanha com dialog

### Nenhuma migracao de banco necessaria

Toda a informacao necessaria (token, dominio) ja esta salva na tabela `user_integrations`.

