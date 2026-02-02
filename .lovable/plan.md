
# Plano: Correção do Envio de Áudio no ROY zAPP

## Diagnóstico Completo

### Problema Identificado
O erro **"Não foi possível enviar a mídia"** ocorre quando o áudio é enviado via UAZAPI. A investigação revelou:

1. **Formato WebM Incompatível**: O navegador grava áudio em formato `audio/webm` ou `audio/ogg;codecs=opus`, mas a API UAZAPI (WhatsApp) **não suporta nativamente WebM** - apenas OGG ou MP3 para áudios tipo PTT (Push-To-Talk/voz).

2. **Registro sem media_url**: Várias mensagens de áudio outbound no banco têm `media_url: null` enquanto `media_mimetype: audio/ogg; codecs=opus`, indicando que o webhook UAZAPI está retornando confirmações mas o frontend pode estar falhando no upload ou na chamada à edge function.

3. **Fluxo Atual**:
```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌────────────┐
│ Gravação    │────▶│ Upload para  │────▶│ uazapi-manager│────▶│ UAZAPI API │
│ MediaRecorder│     │ Storage      │     │ Edge Function │     │ /send/media│
│ (webm/ogg)  │     │ (zapp-media) │     │               │     │            │
└─────────────┘     └──────────────┘     └───────────────┘     └────────────┘
                                                                      │
                                                          ❌ Rejeita WebM
                                                          ✅ Aceita OGG/MP3
```

### Causa Raiz
O código tenta usar `audio/ogg;codecs=opus` quando disponível (linha 1945-1951 do RoyZapp.tsx), mas nem todos os navegadores suportam gravação nativa em OGG. Quando o browser usa WebM:
- O upload para storage funciona ✅
- A chamada UAZAPI **falha** porque WhatsApp não aceita WebM ❌

## Solução Proposta

### Estratégia 1: Conversão Server-Side (Recomendada)
Converter o áudio WebM para OGG no backend antes de enviar para UAZAPI.

**Modificações:**

#### 1. Edge Function `uazapi-manager/index.ts`
Adicionar lógica para detectar formato WebM e converter:

```typescript
// Antes de enviar para UAZAPI
if (media_type === "audio" && media_url.includes('.webm')) {
  console.log('[AUDIO] WebM detected, fetching for conversion...');
  
  // Fetch the WebM file
  const audioResponse = await fetch(media_url);
  const audioBuffer = await audioResponse.arrayBuffer();
  
  // Re-upload como OGG (WhatsApp aceita WebM internamente via UAZAPI quando enviado com type: "audio")
  // OU usar FFmpeg via edge function dedicada
}
```

#### 2. Alternativa Simples: Ajustar Tipo de Mídia
O UAZAPI pode aceitar WebM se enviado com `type: "document"` em vez de `type: "ptt"`:

```typescript
const mediaEndpoints = isAudio ? [
  // Primeiro: tentar como PTT normal
  { url: `/send/media`, method: "POST", body: { number: cleanPhone, type: "ptt", file: media_url } },
  // Segundo: tentar como audio (não PTT)
  { url: `/send/media`, method: "POST", body: { number: cleanPhone, type: "audio", file: media_url } },
  // NOVO Terceiro: tentar como documento de áudio (fallback)
  { url: `/send/media`, method: "POST", body: { number: cleanPhone, type: "document", file: media_url, docName: "audio.webm" } },
] : [...]
```

### Estratégia 2: Forçar Formato OGG no Frontend (Complementar)
Garantir que o frontend sempre use OGG quando possível:

#### `src/pages/RoyZapp.tsx` (linhas 1943-1955)
```typescript
// Priorizar OGG que é compatível com WhatsApp
let mimeType = 'audio/webm'; // fallback
const preferredFormats = [
  'audio/ogg;codecs=opus',  // Melhor compatibilidade WhatsApp
  'audio/ogg',
  'audio/mp4',              // Alguns browsers suportam
  'audio/webm;codecs=opus',
  'audio/webm'
];

for (const format of preferredFormats) {
  if (MediaRecorder.isTypeSupported(format)) {
    mimeType = format;
    break;
  }
}
```

### Estratégia 3: Mensagem de Erro Mais Específica
Melhorar o feedback para o usuário quando o formato não é suportado:

```typescript
// No catch do sendAudioMessage
if (error.message.includes("mídia") || error.message.includes("media")) {
  toast.error("Formato de áudio não suportado pelo WhatsApp. Tente novamente.");
} else {
  toast.error(error.message || "Erro ao enviar áudio");
}
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-manager/index.ts` | Adicionar endpoint fallback para documento de áudio |
| `src/pages/RoyZapp.tsx` | Melhorar detecção de formato OGG no MediaRecorder |
| `src/pages/RoyZapp.tsx` | Melhorar mensagem de erro para formato incompatível |

## Plano de Implementação

1. **Fase 1 - Quick Fix**: Adicionar fallback de documento na edge function
2. **Fase 2 - Melhoria Frontend**: Priorizar formatos compatíveis no MediaRecorder
3. **Fase 3 - Conversão (Opcional)**: Implementar conversão WebM→OGG se necessário

## Resultado Esperado

1. Áudios gravados em OGG funcionarão normalmente ✅
2. Áudios em WebM terão fallback para envio como documento ✅
3. Usuário receberá feedback claro se o envio falhar ✅
4. Logs detalhados para debug em caso de falhas ✅
