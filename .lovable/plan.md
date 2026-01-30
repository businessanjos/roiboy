
# Plano: Corrigir Edge Function de Teste CX Moment

## Problema Identificado

A edge function `test-cx-moment-send` está usando endpoints e formato de requisição incorretos da API UAZAPI, resultando em erro "Method Not Allowed" (405).

## Diagnóstico Detalhado

Comparando os logs de erro com o código funcional do `uazapi-manager`:

```text
Atual (ERRADO):
- URL: ${UAZAPI_URL}/sendText
- Headers: { "Authorization": "Bearer ${token}" }
- Body: { phone, message }

Correto (uazapi-manager):
- URL: ${UAZAPI_URL}/send/text
- Headers: { "token": instanceToken }
- Body: { number, text }
```

## Correções Necessárias

### 1. Endpoint de Texto

| Item | Valor Errado | Valor Correto |
|------|--------------|---------------|
| URL | `/sendText` | `/send/text` |
| Header | `Authorization: Bearer ${token}` | `token: ${token}` |
| Campo telefone | `phone` | `number` |
| Campo mensagem | `message` | `text` |

### 2. Endpoint de Mídia (Imagens)

| Item | Valor Errado | Valor Correto |
|------|--------------|---------------|
| URL | `/sendMedia` | `/send/media` |
| Campo telefone | `phone` | `number` |
| Campo URL | `media` | `file` |
| Campo legenda | `caption` | `text` |

## Arquivo a Modificar

`supabase/functions/test-cx-moment-send/index.ts`

### Mudanças no Envio de Texto (linhas 163-173)

De:
```typescript
const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${instanceToken}`,
  },
  body: JSON.stringify({
    phone: cleanPhone,
    message: personalizedMessage,
  }),
});
```

Para:
```typescript
const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "token": instanceToken,
  },
  body: JSON.stringify({
    number: cleanPhone,
    text: personalizedMessage,
  }),
});
```

### Mudanças na URL do Texto (linha 160)

De:
```typescript
const apiUrl = `${UAZAPI_URL}/sendText`;
```

Para:
```typescript
const apiUrl = `${UAZAPI_URL}/send/text`;
```

### Mudanças no Envio de Mídia (linhas 202-217)

De:
```typescript
const apiUrl = `${UAZAPI_URL}/sendMedia`;
const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${instanceToken}`,
  },
  body: JSON.stringify({
    phone: cleanPhone,
    type: "image",
    media: image.image_url,
    caption: "",
  }),
});
```

Para:
```typescript
const apiUrl = `${UAZAPI_URL}/send/media`;
const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "token": instanceToken,
  },
  body: JSON.stringify({
    number: cleanPhone,
    type: "image",
    file: image.image_url,
    text: "",
  }),
});
```

## Resultado Esperado

Após a correção:
1. Texto será enviado corretamente via `/send/text`
2. Imagens serão enviadas via `/send/media` com o formato correto
3. O teste do momento CX para o número customizado funcionará
