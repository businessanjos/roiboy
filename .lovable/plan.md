

## Corrigir busca de campanhas 3C Plus em domínios personalizados

### Causa raiz

O banco de dados mostra que o Jonathan Marcato configurou domínio `https://anjosbusiness.3c.plus/agent` na integração, enquanto você (ou o Darlan) não tem domínio configurado (usa o padrão `app.3c.fluxoti.com`). Ambos compartilham o **mesmo API Token**.

O problema é duplo:
1. A função `threecplus-auth` valida o token **sempre** contra `app.3c.fluxoti.com` (hardcoded), mesmo quando o usuário informou um domínio diferente
2. A função `threecplus-campaigns` busca campanhas no domínio configurado pelo usuário, que pode ser uma instância diferente do 3C Plus

Resultado: o token é validado com sucesso em `app.3c.fluxoti.com`, mas as campanhas são buscadas em `anjosbusiness.3c.plus` — que pode retornar campanhas diferentes ou nenhuma.

### Solução

#### 1. Corrigir validação do token no `threecplus-auth` (usar domínio do usuário)

**Arquivo:** `supabase/functions/threecplus-auth/index.ts`

Alterar a validação do token (linha 65) para usar o domínio fornecido pelo usuário, em vez do hardcoded:

```typescript
// ANTES (hardcoded):
const apiResponse = await fetch("https://app.3c.fluxoti.com/api/v1/me", { ... });

// DEPOIS (usa o domínio do usuário):
const baseDomain = getBaseDomain(domain || null);
const apiResponse = await fetch(`${baseDomain}/api/v1/me`, { ... });
```

Isso garante que o token seja validado contra a mesma instância onde será usado.

Adicionar a mesma função `getBaseDomain` que já existe em `threecplus-campaigns`.

#### 2. Adicionar logs de diagnóstico na busca de campanhas

**Arquivo:** `supabase/functions/threecplus-campaigns/index.ts`

Adicionar log com o `user_id` e `domain` usado para facilitar diagnóstico futuro:

```typescript
console.log("[threecplus-campaigns] User:", userData.id, "Domain:", baseDomain, "Token (last 6):", apiToken.slice(-6));
```

#### 3. Adicionar fallback de domínio na busca de campanhas

**Arquivo:** `supabase/functions/threecplus-campaigns/index.ts`

Se a busca no domínio customizado retornar 0 campanhas ou falhar, tentar novamente no domínio padrão (`app.3c.fluxoti.com`) como fallback — mas somente se o domínio for diferente do padrão:

```typescript
if (allCampaigns.length === 0 && baseDomain !== "https://app.3c.fluxoti.com") {
  console.log("[threecplus-campaigns] No campaigns on custom domain, trying default...");
  // Repetir busca em app.3c.fluxoti.com
}
```

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/threecplus-auth/index.ts` | Usar domínio do usuário para validar token (em vez de hardcoded) + adicionar `getBaseDomain` |
| `supabase/functions/threecplus-campaigns/index.ts` | Adicionar logs de diagnóstico + fallback para domínio padrão quando domínio customizado retorna 0 campanhas |

