

# Plano: Nova Aba Webhooks nas Integrações

## Visão Geral

Criar uma nova aba "Webhooks" na página de Integrações que permita criar, editar e excluir webhooks customizados com suporte a diversos métodos HTTP.

---

## Arquitetura

### 1. Tabela no Banco de Dados

Criar nova tabela `webhooks` para armazenar as configurações:

```sql
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST', -- GET, POST, PUT, PATCH, DELETE
  headers JSONB DEFAULT '{}',
  payload_template JSONB,
  is_active BOOLEAN DEFAULT true,
  trigger_event TEXT, -- Ex: 'client.created', 'event.updated', etc.
  secret_key TEXT, -- Para validação HMAC
  last_triggered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage webhooks of their account"
ON webhooks FOR ALL USING (
  account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid())
);
```

### 2. Estrutura de Componentes

```text
src/components/integrations/
├── IntegrationsContent.tsx    (modificar - adicionar aba)
├── webhooks/
│   ├── WebhooksTab.tsx        (novo - conteúdo da aba)
│   ├── WebhookCard.tsx        (novo - card individual)
│   ├── WebhookFormDialog.tsx  (novo - dialog criar/editar)
│   └── useWebhooks.tsx        (novo - hook para CRUD)
```

---

## Alterações nos Arquivos

### Arquivo 1: `src/components/integrations/IntegrationsContent.tsx`

**Modificações:**
1. Adicionar import do novo componente `WebhooksTab`
2. Adicionar aba "Webhooks" no `TabsList` (com ícone `Webhook` do lucide)
3. Adicionar `TabsContent` para webhooks

```typescript
// Novo import
import { WebhooksTab } from "./webhooks/WebhooksTab";

// No TabsList (após Meet)
<TabsTrigger value="webhooks" className="gap-2 px-3 py-2">
  <Webhook className="h-4 w-4" />
  <span>Webhooks</span>
</TabsTrigger>

// Novo TabsContent
<TabsContent value="webhooks" className="space-y-4">
  <WebhooksTab accountId={accountId} />
</TabsContent>
```

### Arquivo 2: `src/components/integrations/webhooks/WebhooksTab.tsx` (novo)

Componente principal da aba com:
- Header com título, descrição e botão "Novo Webhook"
- Lista de webhooks existentes em cards
- Estado vazio quando não há webhooks

### Arquivo 3: `src/components/integrations/webhooks/WebhookCard.tsx` (novo)

Card individual do webhook com:
- Nome e descrição
- URL (truncado) com botão copiar
- Badge do método HTTP (GET=azul, POST=verde, PUT=amarelo, PATCH=laranja, DELETE=vermelho)
- Badge de status (Ativo/Inativo)
- Último trigger e status code
- Botões: Testar, Editar, Excluir

### Arquivo 4: `src/components/integrations/webhooks/WebhookFormDialog.tsx` (novo)

Dialog para criar/editar webhook:
- Campo: Nome *
- Campo: Descrição
- Campo: URL *
- Select: Método HTTP (GET, POST, PUT, PATCH, DELETE)
- Campo: Headers (JSON editor ou key-value pairs)
- Campo: Payload Template (JSON editor - apenas para métodos com body)
- Campo: Secret Key (para HMAC)
- Select: Evento Gatilho (lista de eventos disponíveis)
- Switch: Ativo

### Arquivo 5: `src/components/integrations/webhooks/useWebhooks.tsx` (novo)

Hook com React Query para:
- `useWebhooks(accountId)` - listar todos
- `useCreateWebhook` - mutation criar
- `useUpdateWebhook` - mutation atualizar
- `useDeleteWebhook` - mutation deletar
- `useTestWebhook` - mutation testar (chama edge function)

---

## Componentes Visuais

### Métodos HTTP com Cores

| Método | Cor | Badge Variant |
|--------|-----|---------------|
| GET | Azul | `bg-blue-100 text-blue-700` |
| POST | Verde | `bg-green-100 text-green-700` |
| PUT | Amarelo | `bg-yellow-100 text-yellow-700` |
| PATCH | Laranja | `bg-orange-100 text-orange-700` |
| DELETE | Vermelho | `bg-red-100 text-red-700` |

### Eventos Disponíveis (Gatilhos)

```typescript
const WEBHOOK_EVENTS = [
  { value: "client.created", label: "Cliente criado" },
  { value: "client.updated", label: "Cliente atualizado" },
  { value: "client.deleted", label: "Cliente excluído" },
  { value: "event.created", label: "Evento criado" },
  { value: "event.updated", label: "Evento atualizado" },
  { value: "task.completed", label: "Tarefa concluída" },
  { value: "form.submitted", label: "Formulário enviado" },
  { value: "contract.signed", label: "Contrato assinado" },
  { value: "payment.received", label: "Pagamento recebido" },
  { value: "manual", label: "Manual (API)" },
];
```

---

## Layout do Dialog de Criação/Edição

```text
┌──────────────────────────────────────────────────────────────┐
│ ✕                                                            │
│  Criar Webhook / Editar Webhook                              │
│  Configure as opções do seu webhook                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Nome *                          Método HTTP                 │
│  [________________________]      [▼ POST]                    │
│                                                              │
│  URL *                                                       │
│  [https://api.exemplo.com/webhook_______________________]    │
│                                                              │
│  Descrição                                                   │
│  [Webhook para notificar sistema externo________________]    │
│                                                              │
│  Evento Gatilho                  Secret Key                  │
│  [▼ Cliente criado]              [abc123...] (opcional)      │
│                                                              │
│  Headers (JSON)                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ {                                                      │  │
│  │   "X-Custom-Header": "value"                           │  │
│  │ }                                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Payload Template (JSON) - apenas POST/PUT/PATCH             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ {                                                      │  │
│  │   "event": "{{event}}",                                │  │
│  │   "data": "{{data}}"                                   │  │
│  │ }                                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [x] Webhook ativo                                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                              [Cancelar]  [Salvar Webhook]    │
└──────────────────────────────────────────────────────────────┘
```

---

## Resumo das Modificações

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `webhooks` com RLS |
| `IntegrationsContent.tsx` | Adicionar aba Webhooks |
| `webhooks/WebhooksTab.tsx` | Novo - componente da aba |
| `webhooks/WebhookCard.tsx` | Novo - card individual |
| `webhooks/WebhookFormDialog.tsx` | Novo - dialog criar/editar |
| `webhooks/useWebhooks.tsx` | Novo - hook CRUD com React Query |

---

## Próximas Etapas (Futuro)

Após implementação inicial, pode-se adicionar:
1. Edge Function `webhook-trigger` para disparar webhooks automaticamente
2. Logs de execução de webhooks
3. Retry automático com backoff exponencial
4. Validação de assinatura HMAC

