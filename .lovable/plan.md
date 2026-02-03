
# Plano: Corrigir Problema de Mensagens do ROY zAPP para Jonathan Marcato

## Diagnóstico Confirmado

A investigação completa revelou que a instância **"Whatsapp Jota"** do vendedor Jonathan Marcato (554399540408) está conectada corretamente ao WhatsApp, porém o **webhook não está configurado na API do UAZAPI**.

### Evidências

| Verificação | Resultado |
|-------------|-----------|
| Status da instância no UAZAPI | ✅ `state: "open"` (conectado) |
| Webhook no UAZAPI | ❌ `webhook_configured: false` |
| Webhook no banco de dados | ⚠️ `webhook_configured: true` (desatualizado) |
| Última mensagem recebida | 31/01/2026 (3+ dias atrás) |
| Outras instâncias funcionando | ✅ Eternum Club e Diretoria operacionais |

### Causa Raiz

A função `configureWebhook` no `uazapi-manager` está falhando com erros "Method Not Allowed" (HTTP 405) em todos os endpoints tentados:
- `/webhook/set`
- `/webhook`
- `/instance/webhook`
- `/settings/webhook`

Isso indica que a API UAZAPI mudou seus endpoints ou requer formato diferente.

## Modificações Necessárias

### Arquivo: `supabase/functions/uazapi-manager/index.ts`

#### Correção 1: Adicionar novos endpoints de webhook compatíveis com UAZAPI GO v2

Atualizar a função `configureWebhook` (linhas 137-196) para incluir endpoints adicionais:

```typescript
// Adicionar endpoint que pode funcionar para UAZAPI GO v2
const webhookEndpoints = [
  // Novos endpoints (UAZAPI GO v2 documentação)
  { url: `/instance/setWebhook`, method: "POST", body: webhookBody },
  { url: `/webhook/set`, method: "POST", body: webhookBody },
  { url: `/webhook`, method: "POST", body: webhookBody },
  { url: `/instance/webhook`, method: "POST", body: webhookBody },
  { url: `/settings/webhook`, method: "POST", body: webhookBody },
  // PUT methods as fallback
  { url: `/instance/setWebhook`, method: "PUT", body: webhookBody },
  { url: `/webhook/set`, method: "PUT", body: webhookBody },
  { url: `/webhook`, method: "PUT", body: webhookBody },
];
```

#### Correção 2: Atualizar formato do corpo do webhook

O formato atual pode estar incorreto para a versão do UAZAPI em uso:

```typescript
// Formato alternativo para UAZAPI GO v2
const webhookBodyAlt = {
  webhook_url: webhookUrl,
  webhook_enabled: true,
  webhook_events: ["messages", "connection", "qrcode", "chats", "groups"]
};

// Adicionar tentativas com formato alternativo
const webhookEndpointsAlt = [
  { url: `/settings`, method: "POST", body: { webhook: webhookBodyAlt } },
  { url: `/instance/settings`, method: "POST", body: { webhook: webhookBodyAlt } },
];
```

#### Correção 3: Sincronizar estado do banco com a realidade

Atualizar o campo `webhook_configured` no banco apenas quando o webhook for realmente configurado com sucesso no UAZAPI:

```typescript
// Em status, marcar webhook_configured como false se a config falhar
webhook_configured: webhookConfigured, // Não usar fallback do banco se não configurou
```

### Arquivo: `src/components/admin/WhatsAppIntegrationPanel.tsx` (ou similar)

#### Correção 4: Adicionar botão manual de reconfiguração com feedback visual

Adicionar um botão que permita ao admin reconfigurar o webhook manualmente com feedback claro se falhar:

```typescript
// Adicionar alerta visual quando webhook_configured: false
{integration.webhook_configured === false && (
  <Alert variant="destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      Webhook não configurado. Clique em "Reconectar" para corrigir.
    </AlertDescription>
  </Alert>
)}
```

## Ação Imediata Recomendada

Como a configuração automática está falhando, recomendo:

1. **Acessar o painel do UAZAPI** (`cxroycom.uazapi.com`)
2. **Localizar a instância "Whatsapp Jota"**
3. **Configurar manualmente o webhook** com a URL:
   ```
   https://mtzoavtbtqflufyccern.supabase.co/functions/v1/uazapi-webhook
   ```
4. **Ativar os eventos**: `messages`, `connection`, `qrcode`, `chats`, `groups`

## Resumo das Alterações de Código

| Arquivo | Mudança |
|---------|---------|
| `uazapi-manager/index.ts` | Adicionar endpoints `/instance/setWebhook` |
| `uazapi-manager/index.ts` | Adicionar formato alternativo de webhook body |
| `uazapi-manager/index.ts` | Sincronizar campo `webhook_configured` com estado real |
| Painel Admin | Adicionar alerta visual para webhooks não configurados |

## Resultado Esperado

1. ✅ Sistema detecta automaticamente quando webhook não está configurado
2. ✅ Múltiplos formatos de configuração são tentados
3. ✅ Admin recebe feedback visual quando há problema
4. ✅ Opção de configuração manual no painel UAZAPI como fallback
5. ✅ Mensagens do Jonathan voltam a aparecer no ROY zAPP
