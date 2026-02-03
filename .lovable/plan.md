

# Plano: Corrigir Escopos OAuth do Zoom

## Problema Identificado

O erro "Invalid Scope" ocorre porque o código está usando escopos de **administrador** que não são permitidos para aplicativos Zoom do tipo "General App" (User-managed):

```typescript
// Código atual (linhas 98-101) - ESCOPOS INCORRETOS
const scopes = [
  "meeting:write:admin",  // ❌ Escopo de admin
  "user:read:admin",      // ❌ Escopo de admin
].join(" ");
```

## Modificação Necessária

### Arquivo: `supabase/functions/oauth-init/index.ts`

Alterar os escopos do Zoom nas linhas 97-101:

**De:**
```typescript
// Escopos necessários para criar reuniões e obter refresh_token válido
const scopes = [
  "meeting:write:admin",  // Criar reuniões
  "user:read:admin",      // Obter email do usuário
].join(" ");
```

**Para:**
```typescript
// Escopos de usuário (não admin) para criar reuniões
const scopes = [
  "meeting:write:meeting",  // Criar reuniões (escopo de usuário)
  "user:read:user",         // Obter email do usuário (escopo de usuário)
].join(" ");
```

---

## Sobre o Client ID

O usuário mencionou o novo Client ID: `K92hgDt3QIGv8EdTMB350w`

O código está configurado corretamente para ler o Client ID da variável de ambiente `ZOOM_CLIENT_ID` (linha 84):

```typescript
const clientId = Deno.env.get("ZOOM_CLIENT_ID");
```

**Ação necessária do usuário:** Verificar se a variável de ambiente `ZOOM_CLIENT_ID` está configurada com o valor correto (`K92hgDt3QIGv8EdTMB350w`) nas configurações de secrets do projeto.

---

## Verificação de Escopos Ocultos

Verifiquei os arquivos `oauth-init/index.ts` e `oauth-callback/index.ts`:
- Não há outros escopos "admin" sendo injetados
- O `oauth-callback` apenas processa a resposta, não define escopos
- A URL de autorização é construída apenas com os escopos definidos no array

---

## Resumo das Alterações

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `supabase/functions/oauth-init/index.ts` | 98 | `meeting:write:admin` → `meeting:write:meeting` |
| `supabase/functions/oauth-init/index.ts` | 99 | `user:read:admin` → `user:read:user` |

---

## Verificação de Secret

Após a implementação, certifique-se de que:

1. A variável `ZOOM_CLIENT_ID` contém o valor: `K92hgDt3QIGv8EdTMB350w`
2. A variável `ZOOM_CLIENT_SECRET` contém o secret correspondente a este Client ID

---

## Resultado Esperado

1. O erro "Invalid Scope" será resolvido
2. O fluxo OAuth funcionará com escopos de usuário normal
3. Usuários poderão conectar suas contas Zoom sem problemas

