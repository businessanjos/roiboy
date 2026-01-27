
# Plano: Diagnóstico e Correção de Sincronização do ROY zAPP - Setor Operações

## Resumo do Problema

Usuários do setor de **Operações** relatam que conversas, mensagens e grupos visíveis no WhatsApp conectado não estão aparecendo no ROY zAPP. O sistema deveria refletir exatamente o WhatsApp conectado, mas algumas conversas estão faltando.

---

## Diagnóstico: Causas Identificadas

Após análise detalhada do código e da especificação da API UAZAPI, identifiquei **7 causas potenciais** para a desincronização:

### 1. Filtro de Multi-Instância Muito Restritivo

**Problema:** O frontend aplica um filtro por `integration_id` que exclui conversas sem esse campo preenchido. Conversas criadas antes da implementação de multi-instância ou com `integration_id` nulo não aparecem.

```typescript
// src/hooks/useZappData.tsx linha 846-858
if (integrationId) {
  filtered = filtered.filter(a => {
    const convIntegrationId = zappConv?.integration_id;
    return convIntegrationId === integrationId; // Conversas antigas sem integration_id são excluídas!
  });
}
```

**Evidência nos Logs:**
```
[ZappData] MULTI-INSTANCE: Filtered to 234 assignments for integration dbb6109c-... (from 254)
```
20 conversas estão sendo excluídas por esse filtro.

### 2. Webhook Não Recebe Todos os Eventos da UAZAPI

**Problema:** O webhook está configurado para receber apenas alguns tipos de eventos. Segundo a especificação da UAZAPI, há eventos críticos que podem estar faltando:

```typescript
// supabase/functions/uazapi-manager/index.ts linha 147-148
events: ["messages", "connection", "qrcode", "MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"]
```

**Faltando:** `chats`, `groups`, `history` - eventos importantes para sincronização de conversas existentes e grupos.

### 3. Limite de 500 Conversas na Query

**Problema:** O hook de dados limita a 500 registros, o que pode excluir conversas mais antigas em contas com alto volume:

```typescript
// src/hooks/useZappData.tsx linha 178
.limit(500);
```

### 4. Grupos Não São Sincronizados Automaticamente

**Problema:** A sincronização de grupos (`sync_groups`) é uma ação manual. Grupos novos ou alterados no WhatsApp não aparecem automaticamente até que o usuário sincronize manualmente.

### 5. Importação de Conversas Históricas Incompleta

**Problema:** A ação `import-conversations` na uazapi-manager tenta múltiplos endpoints mas pode falhar silenciosamente:

```typescript
// supabase/functions/uazapi-manager/index.ts linhas 3388-3414
const endpoints = ["/chats/list", "/chats", "/chat/list"];
```

Se todos os endpoints falharem, nenhuma conversa histórica é importada.

### 6. Normalização de Telefones Brasileiros

**Problema:** O webhook normaliza números brasileiros de 12 para 13 dígitos, mas a busca por conversas existentes pode falhar se o registro antigo tiver o formato diferente:

```typescript
// Busca por telefone sem considerar variantes
.eq("phone_e164", phone)
```

### 7. Conversas de Grupos Sem Assignment

**Problema:** Algumas conversas de grupo podem existir em `zapp_conversations` mas não ter um registro correspondente em `zapp_conversation_assignments`, tornando-as invisíveis na lista.

---

## Solução Proposta

### Etapa 1: Correção do Filtro Multi-Instância

**Arquivo:** `src/hooks/useZappData.tsx`

Modificar o filtro para incluir conversas sem `integration_id` quando uma instância está selecionada (elas pertencem ao setor e podem ser de antes da implementação multi-instância):

```typescript
// Linha 846-858 - Modificar para incluir conversas antigas
if (integrationId) {
  const beforeCount = filtered.length;
  filtered = filtered.filter(a => {
    const zappConv = a.zapp_conversation as { integration_id?: string; sector_id?: string } | null;
    const convIntegrationId = zappConv?.integration_id;
    const convSectorId = zappConv?.sector_id;
    
    // Incluir conversas que:
    // 1. Pertencem a esta integração OU
    // 2. São do mesmo setor e não têm integration_id (conversas legadas)
    return convIntegrationId === integrationId || 
           (!convIntegrationId && convSectorId === sectorId);
  });
  // ...
}
```

### Etapa 2: Adicionar Eventos Faltantes ao Webhook

**Arquivo:** `supabase/functions/uazapi-manager/index.ts`

Adicionar os eventos `chats`, `groups` e `history` à configuração do webhook:

```typescript
// Linha 147-148
events: [
  "messages", "connection", "qrcode", 
  "MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED",
  "chats", "groups", "history" // NOVOS eventos para sincronização completa
]
```

### Etapa 3: Processar Evento "chats" no Webhook

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts`

Adicionar handler para o evento `chats` que sincroniza novas conversas automaticamente:

```typescript
// Após linha 1595 (antes do handler de "data.messages")
// Handle "chats" event - sync conversations when WhatsApp syncs its chat list
if (eventType === "chats" || eventType === "CHATS_UPDATE") {
  const chatsData = payload.data?.chats || (payload as any).chats || [];
  console.log(`[WEBHOOK] Processing chats event with ${chatsData.length} chats`);
  
  for (const chat of chatsData) {
    // Criar/atualizar zapp_conversation para cada chat
    const isGroup = chat.wa_isGroup || (chat.id || "").includes("@g.us");
    const phone = isGroup ? "" : normalizePhone(chat.phone);
    const groupJid = isGroup ? (chat.wa_chatid || chat.id) : null;
    
    // Upsert conversation...
  }
  
  return new Response(
    JSON.stringify({ success: true, synced: chatsData.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Etapa 4: Processar Evento "groups" no Webhook

Adicionar handler para sincronização automática de grupos:

```typescript
// Handle "groups" event - sync groups automatically
if (eventType === "groups" || eventType === "GROUPS_UPDATE") {
  const groupsData = payload.data?.groups || (payload as any).groups || [];
  console.log(`[WEBHOOK] Processing groups event with ${groupsData.length} groups`);
  
  for (const group of groupsData) {
    const groupJid = group.JID || group.jid || group.id;
    const groupName = group.Name || group.name || group.Subject || group.subject;
    
    if (groupJid && groupJid.includes("@g.us")) {
      // Upsert to whatsapp_groups
      await supabase
        .from("whatsapp_groups")
        .upsert({
          account_id: accountId,
          group_jid: groupJid,
          name: groupName,
          participant_count: group.Participants?.length || group.size || 0,
        }, { onConflict: "account_id,group_jid" });
      
      // Create zapp_conversation for group if doesn't exist
      // ...
    }
  }
}
```

### Etapa 5: Criar Ferramenta de Diagnóstico

**Novo arquivo:** `src/components/admin/WhatsAppDiagnosticsPanel.tsx`

Adicionar um painel de diagnóstico para administradores que:

1. Lista conversas no banco sem assignment
2. Mostra conversas sem integration_id
3. Permite sincronização manual de grupos
4. Compara quantidade de chats no WhatsApp vs ROY zAPP

### Etapa 6: Migrar Conversas Antigas

**Nova Edge Function ou SQL:** Atualizar conversas existentes do setor Operações que não têm `integration_id`:

```sql
-- Identificar conversas do setor operações sem integration_id
UPDATE zapp_conversations zc
SET integration_id = (
  SELECT i.id 
  FROM integrations i 
  WHERE i.account_id = zc.account_id 
    AND i.sector_id = 'operacoes' 
    AND i.type = 'whatsapp' 
    AND i.status = 'connected'
  LIMIT 1
)
WHERE zc.sector_id = 'operacoes' 
  AND zc.integration_id IS NULL;
```

### Etapa 7: Aumentar Limite de Conversas com Paginação

**Arquivo:** `src/hooks/useZappData.tsx`

Implementar carregamento paginado ou virtual scrolling para conversas:

```typescript
// Remover limite fixo de 500 e implementar paginação
.order("updated_at", { ascending: false })
.range(offset, offset + pageSize - 1);
```

---

## Fluxo de Implementação

```text
+------------------+     +--------------------+     +------------------+
|    Etapa 1       |     |     Etapa 2        |     |    Etapa 3-4     |
| Correção Filtro  | --> | Adicionar Eventos  | --> | Handlers Webhook |
| (useZappData)    |     | (uazapi-manager)   |     | (uazapi-webhook) |
+------------------+     +--------------------+     +------------------+
         |                                                   |
         v                                                   v
+------------------+     +--------------------+     +------------------+
|    Etapa 6       |     |     Etapa 5        |     |    Etapa 7       |
| Migrar Dados     | <-- | Painel Diagnóstico | <-- | Paginação        |
| (SQL/Edge Fn)    |     | (Admin Panel)      |     | (useZappData)    |
+------------------+     +--------------------+     +------------------+
```

---

## Arquivos a Modificar

| Arquivo | Mudança | Prioridade |
|---------|---------|------------|
| `src/hooks/useZappData.tsx` | Ajustar filtro multi-instância para incluir conversas legadas | Alta |
| `supabase/functions/uazapi-manager/index.ts` | Adicionar eventos "chats", "groups", "history" ao webhook | Alta |
| `supabase/functions/uazapi-webhook/index.ts` | Adicionar handlers para novos eventos de sincronização | Alta |
| `src/components/admin/WhatsAppDiagnosticsPanel.tsx` | Novo painel de diagnóstico | Média |
| SQL Migration | Migrar integration_id para conversas antigas | Média |

---

## Verificação Pós-Implementação

1. **Conferir logs do webhook** para confirmar recebimento dos novos eventos
2. **Comparar contagem** de chats no WhatsApp vs ROY zAPP
3. **Verificar conversas de grupo** aparecem corretamente
4. **Testar com usuário do setor Operações** para validar que todas as conversas estão visíveis

---

## Seção Técnica: Detalhes da Implementação

### Estrutura de Eventos da UAZAPI

Segundo a especificação OpenAPI fornecida, os eventos disponíveis são:

- `connection` - Estado da conexão
- `history` - Sincronização de histórico (CRÍTICO para conversas existentes)
- `messages` - Novas mensagens
- `messages_update` - Atualizações de status de mensagens
- `call` - Chamadas
- `contacts` - Sincronização de contatos
- `presence` - Status online/offline
- `groups` - Sincronização de grupos
- `labels` - Etiquetas
- `chats` - Lista de conversas
- `chat_labels` - Etiquetas por conversa
- `blocks` - Contatos bloqueados
- `leads` - Leads do UAZAPI

### Campos Críticos para Grupos

A UAZAPI retorna grupos com estes campos (conforme especificação):

```yaml
wa_isGroup: boolean
wa_isGroup_admin: boolean
wa_isGroup_announce: boolean
wa_isGroup_community: boolean
wa_isGroup_member: boolean
wa_chatid: string (formato: 123456789@g.us)
```

### Formato de Telefone Brasileiro

A normalização atual já trata a conversão de 12 para 13 dígitos:

```
+55 71 9739-8455 (12 dígitos) -> +55 71 99739-8455 (13 dígitos)
```

Mas a busca de conversas existentes precisa considerar ambos os formatos com OR condition.
