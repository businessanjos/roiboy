---
name: Normalização canônica de telefone
description: Utilitário compartilhado para resolver divergências de formato (9º dígito BR, com/sem +, com/sem DDI) em endpoints e RoyZapp
type: feature
---

Problema: o mesmo número aparece em múltiplos formatos no banco (`+5551992956336`, `5551992956336`, `+555192956336`, `51992956336`, `5192956336` etc.), causando duplicatas e mensagens RoyZapp não casadas com cliente.

**Utilitário central:** `supabase/functions/_shared/phone-normalize.ts`
- `canonicalE164(input)` → `+55DDD9XXXXXXXX` (corrige 9º dígito BR + adiciona DDI)
- `phoneVariants(input)` → array com TODAS variações (com/sem +, com/sem 9, com/sem DDI) para `.in("phone_e164", variants)`
- `phoneCoreKey(input)` → DDD+8 últimos dígitos (chave de deduplicação)

**Aplicado em:**
- `get-client-by-phone` — endpoint público de busca tolerante
- `uazapi-webhook` — `normalizePhone()` agora delega ao canônico; lookup de client usa variantes
- `ingest-whatsapp-message` — `.in("phone_e164", variants)`

**Regra:** sempre que for fazer lookup por `phone_e164` em edge functions, use `phoneVariants()`. Para gravar/atualizar, use `canonicalE164()`.
