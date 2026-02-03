

# Plano: Melhorar Integração OAuth do Zoom

## Problemas Identificados

### 1. Falta de escopo `offline_access` no Zoom OAuth
No arquivo `supabase/functions/oauth-init/index.ts`, a URL do Zoom OAuth **não inclui o escopo necessário** para obter um refresh_token válido:

```typescript
// Código atual (linha 97-101) - SEM ESCOPOS
const authUrl = new URL("https://zoom.us/oauth/authorize");
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("state", state);
// ❌ NÃO TEM: scope com meeting:write + offline_access
```

Comparação com Google (que funciona):
```typescript
// Google inclui access_type: "offline" (linha 68)
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
```

### 2. Token expira e refresh falha com `invalid_grant`
- O Zoom só fornece refresh_token válido se os escopos corretos forem solicitados
- Sem isso, o refresh_token não funciona após expirar

### 3. Sem tratamento de erro claro quando reconexão é necessária
- Quando o refresh falha, o erro `invalid_grant` não é comunicado claramente ao usuário

---

## Modificações Necessárias

### Arquivo 1: `supabase/functions/oauth-init/index.ts`

Adicionar escopos do Zoom na URL de autorização:

```typescript
if (provider === "zoom") {
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  if (!clientId) {
    throw new Error("ZOOM_CLIENT_ID not configured");
  }

  const state = btoa(JSON.stringify({
    user_id: user.id,
    redirect_path,
    provider: "zoom"
  }));

  const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

  // Escopos necessários para criar reuniões e renovar tokens
  const scopes = [
    "meeting:write:admin",  // Criar reuniões
    "user:read:admin",      // Obter email do usuário
  ].join(" ");

  const authUrl = new URL("https://zoom.us/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);  // ← ADICIONAR
  authUrl.searchParams.set("state", state);

  console.log("Generated Zoom OAuth URL with scopes:", scopes);
  // ...
}
```

### Arquivo 2: `supabase/functions/create-meeting/index.ts`

Melhorar tratamento de erro quando refresh falha:

```typescript
// Na função refreshZoomToken
async function refreshZoomToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  // ... código existente ...

  const responseData = await response.json();
  
  if (!response.ok) {
    console.error("Failed to refresh Zoom token:", responseData);
    // Retornar objeto de erro específico
    if (responseData.error === "invalid_grant") {
      throw new Error("ZOOM_RECONNECT_REQUIRED");
    }
    return null;
  }

  return responseData;
}

// Na função createZoomMeeting, tratar erro específico
if (accessToken && expiresAt && refreshToken) {
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt < now + 300) {
    console.log("Zoom token expired or expiring soon, refreshing...");
    try {
      const newTokens = await refreshZoomToken(refreshToken);
      if (newTokens) {
        accessToken = newTokens.access_token;
        // ... atualizar tokens ...
      }
    } catch (refreshError: any) {
      if (refreshError.message === "ZOOM_RECONNECT_REQUIRED") {
        throw new Error("Sua sessão do Zoom expirou. Por favor, reconecte sua conta em Configurações → Integrações.");
      }
      throw refreshError;
    }
  }
}
```

### Arquivo 3: `src/components/integrations/IntegrationsContent.tsx`

Adicionar indicador de token expirado e botão de reconexão:

```typescript
// Adicionar função para verificar se token está expirado
const isTokenExpired = (integration: UserIntegration) => {
  if (!integration.expires_at) return false;
  const now = Math.floor(Date.now() / 1000);
  return integration.expires_at < now;
};

// Na UI do Zoom, mostrar alerta se token expirado
{zoomUserIntegration && isTokenExpired(zoomUserIntegration) && (
  <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
    <XCircle className="h-5 w-5 text-destructive" />
    <div className="flex-1">
      <p className="font-medium text-destructive">Sessão expirada</p>
      <p className="text-sm text-muted-foreground">
        Reconecte sua conta Zoom para continuar criando reuniões.
      </p>
    </div>
    <Button
      variant="destructive"
      size="sm"
      onClick={() => handleOAuthConnect("zoom")}
      disabled={connectingProvider === "zoom"}
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Reconectar
    </Button>
  </div>
)}
```

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│                  FLUXO OAUTH CORRIGIDO                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ANTES (problema):                                             │
│   oauth-init → URL sem escopos → refresh_token inválido         │
│                                                                 │
│   DEPOIS (correção):                                            │
│   oauth-init → URL com scopes: meeting:write:admin,             │
│                                user:read:admin                  │
│             → refresh_token VÁLIDO                              │
│             → Renovação automática funciona                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   TRATAMENTO DE ERRO:                                           │
│                                                                 │
│   Se refresh falhar com invalid_grant:                          │
│   1. Mostrar alerta "Sessão expirada" na UI                     │
│   2. Botão "Reconectar" visível                                 │
│   3. Erro claro ao criar reunião                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/oauth-init/index.ts` | Adicionar escopos `meeting:write:admin` e `user:read:admin` na URL do Zoom |
| `supabase/functions/create-meeting/index.ts` | Melhorar tratamento de erro `invalid_grant` com mensagem clara |
| `src/components/integrations/IntegrationsContent.tsx` | Mostrar alerta quando token está expirado e botão de reconexão |

---

## Ação Necessária Após Implementação

O usuário atual precisará **reconectar a conta Zoom** (desconectar e conectar novamente) para obter novos tokens com os escopos corretos.

---

## Resultado Esperado

1. Novos tokens do Zoom incluirão refresh_token válido
2. Renovação automática funcionará corretamente
3. Se falhar, usuário verá mensagem clara pedindo reconexão
4. UI mostrará indicador visual de sessão expirada

