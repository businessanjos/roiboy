

# Plano: Sincronização de Histórico de Mensagens do WhatsApp

## Situação Diagnosticada

A instância **"Whatsapp Jota"** do vendedor Jonathan Marcato apresenta:

| Verificação | Resultado |
|-------------|-----------|
| Conexão WhatsApp | ✅ Conectado (`state: "open"`) |
| Webhook configurado | ❌ **Não** (`webhook_configured: false`) |
| Última mensagem recebida | 31/01/2026 15:56 (sexta-feira) |
| Período sem mensagens | 31/01 ~ 03/02 (4 dias) |

**Causa**: O webhook nunca foi configurado corretamente no UAZAPI, então as mensagens desse período não foram capturadas.

---

## Solução Proposta

Implementar uma nova funcionalidade de **Sincronização de Histórico de Mensagens** que permita:

1. Buscar mensagens históricas diretamente da API do UAZAPI
2. Inserir no banco de dados as mensagens que faltam
3. Disponibilizar um botão "Sincronizar Histórico" no painel administrativo

---

## Modificações Técnicas

### 1. Nova Action no Edge Function `uazapi-manager`

Adicionar a action `sync-chat-history` que:

```text
┌─────────────────────────────────────────────────────────────┐
│                    sync-chat-history                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Recebe: integration_id, phone ou chat_id, days (padrão 7)│
│ 2. Busca mensagens via UAZAPI endpoints:                    │
│    - /chat/messages/{chatId}                                │
│    - /chat/{phone}/messages                                 │
│    - /fetchMessages/{chatId}                                │
│ 3. Para cada mensagem:                                      │
│    - Verifica se já existe (external_message_id)            │
│    - Se não existe, insere em zapp_messages                 │
│ 4. Retorna: synced_count, already_existed, errors           │
└─────────────────────────────────────────────────────────────┘
```

### 2. Endpoint de Busca no UAZAPI

Testar os seguintes endpoints disponíveis na API UAZAPI:

```typescript
const historyEndpoints = [
  { url: `/chat/fetchMessages/${chatId}`, method: "POST", body: { limit: 100 } },
  { url: `/chat/messages/${chatId}`, method: "GET" },
  { url: `/chat/${phone}/messages`, method: "GET" },
  { url: `/messages/list`, method: "POST", body: { chatId, limit: 100 } },
];
```

### 3. UI: Botão de Sincronização

Adicionar no painel de Diagnóstico do WhatsApp (`WhatsAppDiagnostics.tsx`):

```text
┌──────────────────────────────────────────────────────────┐
│ Whatsapp Jota                    [🔄 Sincronizar]        │
│ ✅ Conectado | ⚠️ Webhook não configurado                │
│                                                          │
│ [Sincronizar Histórico (últimos 7 dias)]                 │
│                                                          │
│ Útil para recuperar mensagens perdidas quando o          │
│ webhook esteve desconfigurado.                           │
└──────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/uazapi-manager/index.ts` | Adicionar action `sync-chat-history` |
| `src/pages/admin/WhatsAppDiagnostics.tsx` | Adicionar botão "Sincronizar Histórico" |

---

## Fluxo de Sincronização

```text
Usuário clica "Sincronizar Histórico"
            │
            ▼
    Chama uazapi-manager
    action: sync-chat-history
    integration_id: 026d6fef...
    days: 7
            │
            ▼
    Busca conversas ativas
    (zapp_conversations)
            │
            ▼
    Para cada conversa:
    ┌───────────────────────────────────┐
    │ 1. Extrai chatId ou phone         │
    │ 2. Chama UAZAPI /chat/messages    │
    │ 3. Para cada mensagem recebida:   │
    │    - Verifica external_message_id │
    │    - Se não existe → INSERT       │
    └───────────────────────────────────┘
            │
            ▼
    Retorna resultado:
    { synced: 47, skipped: 153, errors: 0 }
```

---

## Ação Imediata Recomendada

Enquanto a funcionalidade é implementada, **configurar manualmente o webhook** no painel UAZAPI:

1. Acessar: `cxroycom.uazapi.com`
2. Localizar instância: **Whatsapp Jota**
3. Configurar webhook URL:
   ```
   https://mtzoavtbtqflufyccern.supabase.co/functions/v1/uazapi-webhook
   ```
4. Ativar eventos: `messages`, `connection`, `qrcode`, `chats`, `groups`, `history`

Isso garantirá que **novas mensagens** comecem a ser capturadas imediatamente.

---

## Resultado Esperado

1. ✅ Botão "Sincronizar Histórico" disponível no painel administrativo
2. ✅ Capacidade de recuperar mensagens de períodos com webhook inativo
3. ✅ Mensagens do Jonathan dos últimos 7 dias sincronizadas
4. ✅ Webhook reconfigurado para capturar novas mensagens

