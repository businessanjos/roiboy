

# Correção: Mídia de Contatos Não Carrega nas Conversas

## Problema Identificado

O sistema de download lazy de mídia (imagens, áudios, vídeos, documentos) está falhando devido a múltiplos problemas:

1. **Sem botão de retry para mídia** - Quando o download falha, usuários veem "Falha ao carregar mídia" mas não podem tentar novamente
2. **Race condition** - Múltiplas chamadas simultâneas à função de download competem pelos mesmos registros
3. **Status travados** - Mensagens ficam presas em "pending" ou "downloading" sem processamento
4. **Sem reprocessamento** - A função só tenta baixar mídia com status `pending`, ignorando `failed` ou `downloading` travados

**Dados do banco confirmam o problema:**
- 177 mensagens com URL criptografada aguardando download
- Apenas ~107 completadas nas últimas 24h
- Função é invocada mas processa apenas 1-2 mensagens por vez

## Solução Proposta

### 1. Adicionar Botão de Retry na UI (`ZappMessageBubble.tsx`)

Quando a mídia falhar, mostrar um botão para o usuário tentar novamente:

```typescript
// Após o bloco que mostra "Falha ao carregar mídia"
{message.media_download_status === "failed" && message.media_type && !message.media_url && (
  <div className="mb-2 rounded-lg overflow-hidden bg-black/20 flex flex-col items-center justify-center p-4 gap-2">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-yellow-500" />
      <span className="text-xs text-zapp-text-muted">Falha ao carregar mídia</span>
    </div>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onRetryMediaDownload?.(message.id)}
      className="text-xs text-zapp-accent hover:text-zapp-accent/80"
    >
      <RefreshCw className="h-3 w-3 mr-1" />
      Tentar novamente
    </Button>
  </div>
)}
```

### 2. Implementar Handler de Retry na Cadeia de Componentes

**Em `ZappMessagesList.tsx`:**
```typescript
onRetryMediaDownload?: (messageId: string) => void;
```

**Em `ZappChatView.tsx`:**
```typescript
const handleRetryMediaDownload = async (messageId: string) => {
  // Resetar status para pending e chamar download
  await supabase
    .from("zapp_messages")
    .update({ media_download_status: "pending" })
    .eq("id", messageId);
  
  // Invocar função de download
  supabase.functions.invoke("download-media", {
    body: { message_ids: [messageId] }
  });
};
```

**Em `RoyZapp.tsx`:**
Passar o handler para a cadeia de componentes.

### 3. Melhorar Edge Function (`download-media/index.ts`)

**a) Incluir status "downloading" travado (>5 min):**
```typescript
// Buscar pending OU downloading travado há mais de 5 minutos
let messagesQuery = supabase
  .from("zapp_messages")
  .select("id, account_id, ...")
  .in("id", idsToProcess)
  .not("media_encrypted_url", "is", null)
  .or(`media_download_status.eq.pending,and(media_download_status.eq.downloading,updated_at.lt.${fiveMinutesAgo})`);
```

**b) Adicionar processamento em paralelo com limite:**
```typescript
// Processar em batches de 5 para evitar timeout
const batchSize = 5;
for (let i = 0; i < messages.length; i += batchSize) {
  const batch = messages.slice(i, i + batchSize);
  await Promise.all(batch.map(msg => processMediaDownload(msg)));
}
```

**c) Adicionar timeout individual por mídia:**
```typescript
const downloadWithTimeout = async (url: string, timeoutMs: number = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};
```

### 4. Auto-retry para Mídias Pendentes ao Abrir Conversa (`useZappData.tsx`)

Expandir filtro para incluir status travados:

```typescript
// Trigger lazy download for pending OR stuck downloading media
const pendingMediaIds = (data || [])
  .filter((m: any) => {
    if (!m.media_type || m.media_url) return false;
    // Status pending
    if (m.media_download_status === "pending") return true;
    // Status failed (permitir retry automático)
    if (m.media_download_status === "failed") return true;
    // Status downloading há mais de 5 minutos (travado)
    if (m.media_download_status === "downloading") {
      const updatedAt = m.updated_at ? new Date(m.updated_at).getTime() : 0;
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return updatedAt < fiveMinutesAgo;
    }
    return false;
  })
  .map((m: any) => m.id);
```

## Arquivos a Modificar

1. **`src/components/royzapp/ZappMessageBubble.tsx`** - Adicionar botão retry e prop
2. **`src/components/royzapp/ZappMessagesList.tsx`** - Passar prop de retry
3. **`src/components/royzapp/ZappChatView.tsx`** - Implementar handler e passar prop
4. **`src/pages/RoyZapp.tsx`** - Implementar handler e passar para chat view
5. **`src/hooks/useZappData.tsx`** - Expandir filtro para incluir status travados
6. **`supabase/functions/download-media/index.ts`** - Melhorar robustez e timeout

## Fluxo de Recuperação

```text
┌────────────────────────────────────────────────────────────────────┐
│  ANTES: Mídia falha → Usuário fica preso sem opção                │
├────────────────────────────────────────────────────────────────────┤
│  DEPOIS:                                                           │
│                                                                    │
│  1. Mídia falha → Mostra botão "Tentar novamente"                 │
│     ↓                                                              │
│  2. Usuário clica → Reset status para "pending"                   │
│     ↓                                                              │
│  3. Chama download-media com ID específico                        │
│     ↓                                                              │
│  4. Realtime atualiza UI quando media_url é populado              │
│                                                                    │
│  OU                                                                │
│                                                                    │
│  1. Mídia com status "failed" ou "downloading" travado            │
│     ↓                                                              │
│  2. Usuário abre conversa → auto-retry automático                 │
│     ↓                                                              │
│  3. Mídia carrega sem ação manual                                 │
└────────────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

- ✅ Mídias travadas em "pending" serão reprocessadas automaticamente
- ✅ Mídias com status "failed" terão botão de retry visível
- ✅ Downloads que travaram em "downloading" serão recuperados
- ✅ Melhor UX com feedback visual claro do status
- ✅ Sistema mais resiliente a timeouts e falhas de rede

