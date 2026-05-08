---
name: roy-zapp/spam-prevention-and-compliance-pt
description: Anti-spam do RoyZapp — duplicate check é POR sender_user_id (não por account_id), permitindo múltiplos agentes no mesmo número
type: feature
---

Anti-spam do `uazapi-manager` (envio WhatsApp):

1. **Checagem de mensagem idêntica (duplicate)**: filtrada por `account_id + sender_user_id + content` nos últimos 30min. Bloqueia (429) se o **mesmo usuário** mandou a mesma mensagem para 5+ destinatários únicos diferentes.
   - Importante: NÃO é por account inteira. Múltiplos closers no mesmo número/instância podem usar templates parecidos sem se bloquearem mutuamente. Cada um tem seu próprio contador.

2. **Limite por hora**: 80 mensagens outbound/hora por `sender_user_id` (429 se exceder).

3. **Fila de envio por token (instância)**: `uazapi-manager` mantém uma FIFO em memória (`tokenSendChains`) por `instance_token`. Todos os `/send/text` e `/send/media` (incluindo grupos) passam pelo `enqueueSend(token, ...)`, que serializa as chamadas à mesma instância UAZAPI e impõe gap mínimo de ~700ms + jitter 0–800ms entre envios consecutivos no mesmo token.
   - Por que: quando 3 closers compartilham o mesmo número, evita bursts concorrentes que viram 429/500 da UAZAPI ou comportamento de "spam" para o WhatsApp. Closers em instâncias diferentes não se afetam (queues separadas por token).
   - Não substitui rate limit por usuário nem checagem de duplicidade — é camada extra de cadência.

4. Compliance geral: variar texto, evitar broadcast em massa idêntico, manter padrão "humano" para reduzir risco de ban no WhatsApp.
