
## Integracao Omie - Ordem de Servico automatica ao ganhar negocio

### Visao Geral

Criar uma integracao completa entre o ROY APP e o ERP Omie que, ao marcar um negocio como "Ganho" no Pipeline, dispare automaticamente a criacao de uma Ordem de Servico (OS) no Omie. Inclui interface de configuracao, mapeamento visual de campos, e logs de execucao.

### 1. Banco de Dados - Novas Tabelas

**Tabela `omie_settings`** - Armazena configuracao por conta
- `id` UUID PK
- `account_id` UUID FK accounts
- `app_key` TEXT (encriptada)
- `app_secret` TEXT (encriptada)
- `is_enabled` BOOLEAN default false
- `field_mappings` JSONB (mapeamento de campos OS -> fonte no ROY)
- `default_service_code` TEXT (codigo do servico padrao na OS)
- `created_at`, `updated_at` TIMESTAMPS

**Tabela `omie_integration_logs`** - Historico das ultimas tentativas
- `id` UUID PK
- `account_id` UUID FK accounts
- `deal_id` UUID FK deals
- `action` TEXT ('create_os')
- `status` TEXT ('success', 'error')
- `omie_os_id` TEXT (ID da OS retornado pela Omie)
- `request_payload` JSONB
- `response_payload` JSONB
- `error_message` TEXT
- `created_at` TIMESTAMP

RLS: ambas tabelas acessiveis apenas por membros da mesma account.

### 2. Edge Function `create-omie-os`

Nova edge function que:
1. Recebe `deal_id` e `account_id`
2. Busca configuracoes em `omie_settings`
3. Busca dados do negocio, cliente, campos personalizados
4. Busca/cria cliente no Omie via CPF/CNPJ ou nome
5. Monta payload da OS usando os field_mappings configurados
6. Chama API Omie `POST /servicos/os/` metodo `IncluirOS`
7. Salva resultado em `omie_integration_logs`
8. Retorna sucesso/erro

### 3. Interface - Aba Omie nas Integracoes

**Arquivo: `src/components/integrations/OmieIntegrationTab.tsx`**

Novo componente com as seguintes secoes:

**A) Configuracao de Credenciais**
- Campos APP_KEY e APP_SECRET (tipo password)
- Botao "Testar Conexao" (chama ListarClientes com pagina 1 registros 1)
- Toggle "Ativar Automacao" (habilita/desabilita o trigger no handleMarkAsWon)
- Botao "Salvar"

**B) Mapeamento Visual de Campos da OS**
- Interface visual similar a tela de criacao de OS do Omie (referencia da imagem)
- Campos da OS exibidos (Cliente, Vendedor, Descricao, Valor, etc.)
- Cada campo e clicavel e abre um dropdown com opcoes de origem dos dados:
  - Campos fixos do negocio (titulo, valor, descricao, responsavel)
  - Campos do cliente (nome, CPF/CNPJ, telefone)
  - Campos personalizados do negocio (dinamico, buscados da tabela custom_fields)
- O mapeamento e salvo em `omie_settings.field_mappings` como JSONB

**C) Logs de Integracao**
- Tabela com as ultimas 10 tentativas
- Colunas: Data, Negocio, Status (badge verde/vermelho), ID da OS
- Botao para expandir e ver detalhes do payload/erro

### 4. Trigger no Pipeline

**Arquivo: `src/pages/SalesPipeline.tsx`**

No `handleMarkAsWon`, apos o STEP 6 (markAsWon), adicionar novo STEP 7:

```text
STEP 7: Omie OS Integration
1. Buscar omie_settings para a account
2. Se is_enabled === true:
   a. Chamar edge function create-omie-os
   b. Exibir toast de sucesso/erro (nao bloqueia o fluxo)
```

A chamada e nao-bloqueante (fire-and-forget com toast) para nao impactar a experiencia do usuario.

### 5. Adicionar aba no IntegrationsContent

**Arquivo: `src/components/integrations/IntegrationsContent.tsx`**

- Adicionar item "Omie" na lista de integracoes e nas tabs
- Usar icone de Building ou FileSpreadsheet
- Renderizar `OmieIntegrationTab` no conteudo da tab

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabelas `omie_settings` e `omie_integration_logs` |
| `supabase/functions/create-omie-os/index.ts` | Nova edge function |
| `src/components/integrations/OmieIntegrationTab.tsx` | Novo componente principal |
| `src/components/integrations/OmieFieldMapper.tsx` | Novo componente de mapeamento visual |
| `src/components/integrations/OmieLogsTable.tsx` | Novo componente de logs |
| `src/components/integrations/IntegrationsContent.tsx` | Adicionar tab Omie |
| `src/pages/SalesPipeline.tsx` | Adicionar STEP 7 no handleMarkAsWon |

### Seguranca

- APP_KEY e APP_SECRET salvos no banco (nao em secrets do Supabase) para ser por-conta
- Acesso controlado por RLS (account_id)
- Edge function usa service_role para ler as credenciais
- Logs nao expoe secrets, apenas payloads sanitizados
