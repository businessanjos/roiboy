

## Compartilhar Painel de Insights via Link Publico

### Resumo

Adicionar um botao "Compartilhar" ao lado de "Modo Foco" nos paineis do Insights. Esse botao (visivel apenas para Admin/Gestor) gera um link publico de visualizacao. Quem acessar o link informa seu email para solicitar acesso, e o dono do painel recebe uma notificacao para "Liberar" ou "Recusar".

### Fluxo do Usuario

```text
Gestor/Admin clica "Compartilhar"
  -> Modal exibe link unico do painel
  -> Link copiado e enviado a terceiro

Terceiro abre o link
  -> Pagina publica pede email
  -> Submete email -> Solicitacao criada no banco
  -> Notificacao enviada ao dono do painel

Dono do painel ve notificacao
  -> Clica "Liberar" ou "Recusar"
  -> Se liberado, visitante consegue ver o painel (somente leitura)
```

### 1. Novas Tabelas (Migracao SQL)

**`insights_dashboard_shares`** - Armazena tokens de compartilhamento por painel

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | ID do registro |
| dashboard_id | uuid FK -> insights_dashboards | Painel compartilhado |
| account_id | uuid | Conta dona |
| share_token | text UNIQUE | Token unico no link |
| created_by | uuid FK -> users | Quem criou o link |
| is_active | boolean | Se o link esta ativo |
| created_at | timestamptz | Data de criacao |

**`insights_share_access_requests`** - Solicitacoes de acesso

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | ID |
| share_id | uuid FK -> insights_dashboard_shares | Referencia ao link |
| email | text | Email do solicitante |
| status | text | 'pending', 'approved', 'rejected' |
| reviewed_by | uuid | Quem aprovou/recusou |
| reviewed_at | timestamptz | Data da revisao |
| created_at | timestamptz | Data da solicitacao |

Ambas com RLS habilitado. Politicas para que apenas usuarios da conta possam gerenciar.

### 2. Edge Function: `shared-dashboard`

Nova Edge Function que nao requer JWT (`verify_jwt = false`) com duas rotas:

- **POST `/shared-dashboard`** com `{ share_token, email }`:
  - Valida o token ativo
  - Cria registro em `insights_share_access_requests` com status 'pending'
  - Cria notificacao para o `created_by` do share com tipo 'dashboard_share_request'
  - Retorna sucesso

- **GET `/shared-dashboard?token=...&email=...`**:
  - Valida token ativo
  - Verifica se existe access_request aprovado para esse email
  - Se aprovado, retorna dados do dashboard + visuals + dados dos visuais (deals agregados)
  - Se pendente/rejeitado, retorna status correspondente

### 3. Edge Function: `manage-share-access`

Edge Function autenticada para aprovar/rejeitar solicitacoes:

- **PATCH** com `{ request_id, action: 'approve' | 'reject' }`:
  - Requer autenticacao (JWT ou roy_sk_)
  - Atualiza o status do request
  - Se aprovado, envia notificacao (opcional) de confirmacao

### 4. Alteracoes no Frontend

**`src/components/insights/InsightsMainContent.tsx`**:
- Importar `usePermissions` e `useCurrentUser`
- Adicionar botao "Compartilhar" (icone Share2) entre "Modo Foco" e "Adicionar Visual"
- Visivel apenas quando `isAdmin || team_role_name === "Gestor" || team_role_name === "Admin"`
- Abre o modal `ShareDashboardModal`

**`src/components/insights/ShareDashboardModal.tsx`** (novo):
- Modal com Dialog do Radix
- Ao abrir, verifica se ja existe um share ativo para o dashboard. Se sim, exibe o link. Se nao, cria um novo.
- Exibe o link com botao "Copiar"
- Lista solicitacoes pendentes com botoes "Liberar" e "Recusar"
- Opcao de desativar o link

**`src/pages/SharedInsightsDashboard.tsx`** (nova pagina):
- Pagina publica acessivel em `/shared/insights/:token`
- Formulario simples de email
- Apos submeter, mostra estado: "Solicitacao enviada, aguardando aprovacao"
- Se email ja aprovado, renderiza o painel em modo somente leitura
- Armazena email no localStorage para recarregamentos

**`src/App.tsx`**:
- Adicionar rota `/shared/insights/:token` apontando para `SharedInsightsDashboard`

### 5. Notificacoes

Ao criar uma solicitacao de acesso, inserir na tabela `notifications`:
- `type`: 'dashboard_share_request'
- `title`: 'Solicitacao de acesso ao painel'
- `content`: 'fulano@email.com solicitou acesso ao painel "Nome do Painel"'
- `link`: '/insights/{dashboard_id}' (para o dono abrir o modal de compartilhamento)
- `source_type`: 'insights_share_request'
- `source_id`: ID do request

### 6. Seguranca

- Tokens gerados com `crypto.randomUUID()` (suficientemente aleatorios)
- Acesso aos dados somente apos aprovacao explicita
- RLS nas tabelas de share restritas a `account_id` do usuario
- Edge functions publicas nao expoe dados sem email aprovado
- A pagina publica nao requer login no ROY

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL (2 tabelas) | Criar |
| `supabase/functions/shared-dashboard/index.ts` | Criar |
| `supabase/functions/manage-share-access/index.ts` | Criar |
| `supabase/config.toml` | Adicionar 2 funcoes |
| `src/components/insights/ShareDashboardModal.tsx` | Criar |
| `src/components/insights/InsightsMainContent.tsx` | Modificar (botao share) |
| `src/pages/SharedInsightsDashboard.tsx` | Criar |
| `src/App.tsx` | Adicionar rota publica |

