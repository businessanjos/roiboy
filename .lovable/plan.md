
# Plano: Corrigir Download Automático de Mídias no RoyZapp

## Diagnóstico do Problema

### O Que Está Acontecendo
Quando alguém envia uma foto/vídeo/áudio no WhatsApp, o sistema recebe a mensagem mas não baixa a mídia automaticamente. Isso faz com que os atendentes vejam apenas "Carregando mídia..." indefinidamente, atrasando o atendimento.

### Dados do Problema (Análise do Banco)
- **5.693 mídias pendentes** esperando download (algumas desde dezembro de 2025!)
- **148 mídias falharam** ao tentar baixar
- **13 mídias travadas** no status "downloading"
- Apenas **4.496 mídias** foram baixadas com sucesso

### Causa Raiz Identificada
O download automático foi intencionalmente desabilitado para economizar recursos de cloud (linha 620-621 do `useZappData.tsx`):

```typescript
// OPTIMIZATION: Disabled auto-retry for media downloads to reduce cloud consumption
// Media is now only downloaded when user explicitly clicks "Tentar novamente"
```

Porém, isso criou um problema sério: **as mídias nunca são baixadas automaticamente**, ficando em "Carregando mídia..." para sempre até o usuário clicar manualmente em "Tentar novamente".

## Solução Proposta

Implementar um **download automático inteligente** quando o atendente abre a conversa, com as seguintes otimizações:

1. **Disparo sob demanda**: Só baixar quando alguém realmente abrir a conversa
2. **Limite de processamento**: Processar no máximo 10 mídias pendentes por vez para evitar timeout
3. **Exclusão de stickers**: Não processar stickers (são menos prioritários)
4. **Debounce**: Evitar chamadas duplicadas ao trocar rapidamente de conversa

---

## Alterações Técnicas

### 1. `src/hooks/useZappData.tsx` - Reativar Download Automático

**Localização**: Após o `fetchMessages` no `useCallback` (linhas 618-625)

**Mudanças**:
- Após carregar as mensagens, identificar quais têm `media_download_status === "pending"` e `media_type` diferente de `sticker`
- Disparar a edge function `download-media` com os IDs dessas mensagens pendentes
- Limitar a 10 mensagens por chamada para evitar timeout

```typescript
// Após setMessages(msgs);

// REACTIVATED: Auto-download pending media when conversation is opened
const pendingMediaMsgs = msgs.filter(
  m => m.media_download_status === "pending" 
    && m.media_type 
    && m.media_type !== "sticker"
    && !m.media_url
);

if (pendingMediaMsgs.length > 0) {
  // Limit to 10 to avoid timeout
  const idsToDownload = pendingMediaMsgs.slice(0, 10).map(m => m.id);
  console.log(`[ZappData] Triggering auto-download for ${idsToDownload.length} pending media`);
  
  // Fire-and-forget to avoid blocking UI
  supabase.functions.invoke("download-media", {
    body: { message_ids: idsToDownload }
  }).catch(err => console.error("[ZappData] Auto-download error:", err));
}
```

### 2. `supabase/functions/download-media/index.ts` - Melhorias de Performance

**Mudanças**:
- Aumentar batch size de 5 para 8 para processar mais rápido
- Adicionar log mais detalhado para debugging
- Garantir que mensagens "downloading" há muito tempo sejam reprocessadas

### 3. `src/pages/RoyZapp.tsx` - Garantir Atualização Visual

**Localização**: Após o download bem-sucedido no retry manual (linhas 3790-3805)

**Mudança**: A lógica de retry já funciona, mas precisamos garantir que o realtime esteja atualizando o UI quando o download completa. Verificar se o UPDATE do `media_download_status` está sendo capturado.

---

## Fluxo de Dados

```text
Atendente abre conversa
        │
        ▼
fetchMessages() carrega mensagens
        │
        ▼
Identifica mídias com status "pending"
        │
        ▼
Dispara download-media para até 10 mídias
        │
        ▼
Edge function baixa, descriptografa e armazena
        │
        ▼
Atualiza zapp_messages com media_url + status "completed"
        │
        ▼
Realtime captura UPDATE e atualiza UI
        │
        ▼
Imagem/áudio/vídeo aparece na conversa
```

---

## Considerações de Performance

1. **Limite de 10 mídias**: Evita timeout da edge function (que processa em batches de 5)
2. **Fire-and-forget**: Não bloqueia o carregamento da conversa
3. **Exclusão de stickers**: Reduz processamento desnecessário
4. **Processamento em batch**: A edge function já processa em paralelo (5 por vez)

## Benefícios

- Mídias serão baixadas automaticamente quando o atendente abrir a conversa
- Atendentes não precisarão mais clicar em "Tentar novamente" manualmente
- Redução drástica do tempo de espera para visualizar fotos/áudios/vídeos
- Backlog de 5.693 mídias será gradualmente processado conforme conversas são abertas

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Aumento de consumo de cloud | Limite de 10 mídias por conversa aberta |
| Timeout da edge function | Batch de 5 com timeout individual de 30s |
| Duplicação de downloads | Edge function já ignora mídias já processadas |

## Arquivos a Serem Modificados

1. `src/hooks/useZappData.tsx` - Adicionar lógica de auto-download
2. `supabase/functions/download-media/index.ts` - Ajustes de performance (opcional)
