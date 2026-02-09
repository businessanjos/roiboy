

# Corrigir Parsing de Telefone na Edge Function get-client-by-phone

## Problema
O caractere `+` em query parameters de URL e interpretado como espaco pelo padrao URL encoding. Quando o n8n envia `?phone_e164=+5511991689572`, o servidor recebe ` 5511991689572` (com espaco no inicio), que falha na validacao regex `^\+[1-9]\d{6,14}$`.

## Solucao

Adicionar tratamento no inicio da Edge Function `get-client-by-phone` para normalizar o telefone recebido:
1. Fazer trim do valor
2. Se comecar com espaco (que era um `+` decodificado), substituir por `+`
3. Se nao comecar com `+`, adicionar `+` automaticamente

## Mudanca Tecnica

**Arquivo:** `supabase/functions/get-client-by-phone/index.ts`

Apos obter o parametro `phone` da URL (linha ~22), adicionar normalizacao:

```typescript
// Antes da validacao
let phone = url.searchParams.get("phone_e164");
// Normalizar: URL decode transforma + em espaco
if (phone) {
  phone = phone.trim();
  if (!phone.startsWith("+")) {
    phone = "+" + phone;
  }
}
```

Isso garante que tanto `+5511991689572` quanto `%2B5511991689572` quanto ` 5511991689572` (espaco por decode do +) funcionem corretamente.

## Impacto
- Nenhuma mudanca no frontend
- Compatibilidade retroativa total (quem ja envia corretamente continua funcionando)
- Protege contra esse problema em qualquer integracao futura (n8n, Make, Zapier, etc.)

