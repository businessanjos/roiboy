---
name: roy-zapp/spam-prevention-and-compliance-pt
description: Anti-spam do RoyZapp — duplicate check é POR sender_user_id (não por account_id), permitindo múltiplos agentes no mesmo número
type: feature
---

Anti-spam do `uazapi-manager` (envio WhatsApp):

1. **Checagem de mensagem idêntica (duplicate)**: filtrada por `account_id + sender_user_id + content` nos últimos 30min. Bloqueia (429) se o **mesmo usuário** mandou a mesma mensagem para 5+ destinatários únicos diferentes.
   - Importante: NÃO é por account inteira. Múltiplos closers no mesmo número/instância podem usar templates parecidos sem se bloquearem mutuamente. Cada um tem seu próprio contador.

2. **Limite por hora**: 80 mensagens outbound/hora por `sender_user_id` (429 se exceder).

3. Compliance geral: variar texto, evitar broadcast em massa idêntico, manter padrão "humano" para reduzir risco de ban no WhatsApp.
