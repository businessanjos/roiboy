

## Exportação incompleta de negócios — Dados de contato faltando

### Problema identificado

A exportação busca dados de contato **apenas** da tabela `leads` (via `leads(full_name, phone, email)` no join). Porém, existem **39 negócios** que não possuem `lead_id` — eles estão vinculados apenas a um `client_id` (ex: renovações, carteira). Para esses negócios, nome, telefone e email ficam vazios.

**Exemplo concreto**: O negócio "[CARTEIRA - EP] Jhulia Gabrielly Marcon Padilha" não tem `lead_id`, mas tem `client_id` apontando para a cliente "Jhulia Padilha" com telefone `+554196196728`. A exportação atual ignora completamente esses dados.

### Solução

Alterar a query de exportação para também buscar dados da tabela `clients` e usar como fallback quando o lead não existe.

### Alterações — `src/components/sales/PipelineExportDialog.tsx`

**1. Query: incluir join com clients (linha ~211-213)**

Adicionar `clients(full_name, phone_e164, emails)` ao select da query, junto com o join de leads já existente.

```typescript
.select(
  `id, title, value, status, probability, tags, created_at, won_at, lost_at, lost_reason, stage_id, responsible_user_id, lead_id, client_id,
  leads(full_name, phone, email),
  clients!deals_client_id_fkey(full_name, phone_e164, emails)`
)
```

**2. Resolução com fallback (linhas ~328-337)**

Ao montar cada linha, usar dados do lead quando disponível, e fazer fallback para dados do client:

```typescript
const lead = deal.leads;
const client = deal.clients;

// Nome: lead > client
const contactName = lead?.full_name || client?.full_name || "";

// Telefone: lead > client
const contactPhone = lead?.phone || client?.phone_e164 || "";

// Email: lead > client (clients usa array emails)
const contactEmail = lead?.email || 
  (Array.isArray(client?.emails) && client.emails.length > 0 ? client.emails[0] : "") || "";
```

**3. Usar as variáveis resolvidas nos campos fixos**

Substituir as referências diretas `lead?.full_name`, `lead?.phone`, `lead?.email` pelas variáveis com fallback.

### Resultado esperado

- Todos os 840 negócios terão dados de contato preenchidos (quando disponíveis no sistema)
- Negócios vinculados apenas a clientes (renovações, carteira) terão nome, telefone e email do cliente
- Nenhuma mudança na interface visual — apenas a lógica de exportação é corrigida

