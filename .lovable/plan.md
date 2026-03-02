

## Normalizar telefone com variantes de codigo de pais na Edge Function

### Problema

O n8n envia o telefone como `47991329879` (sem codigo de pais). A funcao `get-client-by-phone` normaliza para `+47991329879` (adiciona apenas o `+`), mas no banco o lead esta salvo como `+5547991329879`. O match falha porque os formatos nao coincidem.

### Solucao

Alterar a Edge Function `get-client-by-phone` para gerar variantes do telefone e buscar por todas elas. Se o numero recebido nao comeca com `+55`, criar tambem a variante com `+55` prefixado. Se comeca com `+55`, criar tambem a variante sem o `+55`.

### Alteracoes

**Arquivo: `supabase/functions/get-client-by-phone/index.ts`**

1. Apos a normalizacao do telefone (linha 28-33), gerar um array de variantes:

```text
Exemplo: input "47991329879"
  -> normalizado: "+47991329879" (logica atual)
  -> variantes: ["+47991329879", "+5547991329879"]

Exemplo: input "+5547991329879"
  -> variantes: ["+5547991329879", "+47991329879"]
```

2. Relaxar a validacao de formato (linha 46) para aceitar numeros sem codigo de pais (minimo 8 digitos apos o +), ja que a funcao vai tentar multiplas variantes.

3. Nas buscas de clients (linha 69-74) e leads (linha 89-94), trocar `.eq("phone_e164", phone)` / `.eq("phone", phone)` por `.in("phone_e164", phoneVariants)` / `.in("phone", phoneVariants)`.

4. Nas buscas de additional_phones (linhas 103-122), tentar todas as variantes tambem.

### Impacto

- Nenhuma mudanca no frontend
- Retrocompativel: quem ja envia `+5547...` continua funcionando
- O n8n pode enviar `47991329879` ou `+5547991329879` e ambos encontram o lead
