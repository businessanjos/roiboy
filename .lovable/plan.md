

## Adicionar 4 Campos Fixos ao Cadastro de Leads

### Contexto

A tabela `leads` ja possui `responsible_user_id` (Proprietario) e `revenue_range` (Faturamento), mas eles nao aparecem no formulario de criacao nem no detalhe do lead. Os campos MQL e Canal precisam de novas colunas no banco.

### 1. Migracao de Banco de Dados

Adicionar duas novas colunas na tabela `leads`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `mql` | `text` (nullable) | Valores: `"sim"` ou `"nao"` |
| `canal` | `text` (nullable) | Canal de venda (ex: Trafego Pago, Indicacao, Organico, etc) |

### 2. Opcoes dos Campos

- **MQL**: Escolha entre "Sim" e "Nao"
- **Proprietario**: Selecionar usuario da equipe (ja existe como `responsible_user_id`)
- **Canal**: Opcoes como Trafego Pago, Indicacao, Organico, Instagram, WhatsApp, Google, Evento, Outro
- **Faturamento**: Faixas ja existentes no sistema (Ate R$81mil, R$81mil-R$360mil, etc, usando `revenue_range`)

### 3. Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| **Migracao SQL** | Adicionar colunas `mql` e `canal` na tabela `leads` |
| `src/hooks/useLeads.tsx` | Adicionar `mql` e `canal` ao tipo `Lead` e `CreateLeadData` |
| `src/pages/Leads.tsx` | Adicionar os 4 campos no formulario de criacao/edicao (step `lead-form`) |
| `src/components/leads/LeadDetailSheet.tsx` | Exibir os 4 campos na visualizacao do lead |

### 4. Detalhes Tecnicos

**Formulario de Criacao (Leads.tsx)**:
- Adicionar `mql`, `canal`, `responsible_user_id` e `revenue_range` ao `formData` state
- Inserir 4 novos campos Select no formulario entre Origem e Observacoes
- MQL: Select com opcoes Sim/Nao
- Canal: Select com opcoes pre-definidas
- Proprietario: Select carregando usuarios da equipe (`users` table)
- Faturamento: Select com as faixas `REVENUE_RANGES` ja definidas no arquivo

**Detalhe do Lead (LeadDetailSheet.tsx)**:
- Exibir os 4 campos como informacoes fixas na secao de contato, com icones apropriados
- Proprietario mostra nome do usuario
- MQL, Canal e Faturamento mostram seus respectivos labels

**Hook useLeads.tsx**:
- Adicionar `mql: string | null` e `canal: string | null` ao tipo `Lead`
- Adicionar `mql?: string` e `canal?: string` ao tipo `CreateLeadData`
- Incluir no `resetForm` e no `openEditDialog`

