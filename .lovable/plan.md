

# Plano: Migrar Zoom para OAuth 2.0 Authorization Code Grant

## Diagnóstico

O erro `unsupported_grant_type` ocorre porque a função `createZoomMeeting` usa autenticação **Server-to-Server OAuth** (`grant_type=account_credentials`), mas o aplicativo Zoom é do tipo **General App (User-managed)** que requer o fluxo **Authorization Code Grant**.

### Boa notícia

O fluxo OAuth para Zoom **JÁ ESTÁ IMPLEMENTADO** nas Edge Functions:
- `oauth-init`: Gera URL de autorização do Zoom ✅
- `oauth-callback`: Troca o código por tokens e salva em `user_integrations` ✅

O problema está **APENAS** na função `create-meeting` que ignora esses tokens e tenta usar `account_credentials`.

---

## Modificações Necessárias

### Arquivo: `supabase/functions/create-meeting/index.ts`

#### 1. Adicionar função `refreshZoomToken`

```typescript
async function refreshZoomToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
  
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    const response = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh Zoom token:", await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error refreshing Zoom token:", error);
    return null;
  }
}
```

#### 2. Reescrever função `createZoomMeeting`

Alterar de:
```typescript
async function createZoomMeeting(
  startTime: string,
  endTime: string,
  title: string,
  participantEmail?: string
)
```

Para:
```typescript
async function createZoomMeeting(
  startTime: string,
  endTime: string,
  title: string,
  participantEmail: string | undefined,
  supabaseClient: any,
  userId?: string
)
```

**Nova lógica:**
1. Buscar tokens do usuário em `user_integrations` (igual ao Google)
2. Verificar se token expirou e fazer refresh se necessário
3. Usar o `access_token` para criar a reunião
4. Se não houver tokens, retornar erro pedindo para conectar a conta Zoom

```typescript
async function createZoomMeeting(
  startTime: string,
  endTime: string,
  title: string,
  participantEmail: string | undefined,
  supabaseClient: any,
  userId?: string
): Promise<{ meeting_url: string; meeting_id: string; meeting_password: string }> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let expiresAt: number | null = null;

  // Get user-level OAuth tokens from user_integrations
  if (userId) {
    const { data: userIntegration } = await supabaseClient
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", "zoom")
      .maybeSingle();

    if (userIntegration?.access_token) {
      accessToken = userIntegration.access_token;
      refreshToken = userIntegration.refresh_token;
      expiresAt = userIntegration.expires_at;
      console.log("Using user-level Zoom OAuth tokens");
    }
  }

  // Check if token needs refresh
  if (accessToken && expiresAt && refreshToken) {
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt < now + 300) { // 5 minute buffer
      console.log("Zoom token expired or expiring soon, refreshing...");
      const newTokens = await refreshZoomToken(refreshToken);
      if (newTokens) {
        accessToken = newTokens.access_token;
        const newExpiresAt = Math.floor(Date.now() / 1000) + newTokens.expires_in;
        
        // Update stored token
        if (userId) {
          await supabaseClient
            .from("user_integrations")
            .update({ 
              access_token: accessToken,
              refresh_token: newTokens.refresh_token || refreshToken,
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", userId)
            .eq("provider", "zoom");
        }
        console.log("Zoom token refreshed successfully");
      }
    }
  }

  if (!accessToken) {
    throw new Error("Zoom não conectado. Por favor, conecte sua conta Zoom em Configurações → Integrações.");
  }

  // Calculate duration
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

  // Create meeting using user's access token
  const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: title,
      type: 2,
      start_time: startTime,
      duration: durationMinutes,
      timezone: "America/Sao_Paulo",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
        ...(participantEmail && { meeting_invitees: [{ email: participantEmail }] }),
      },
    }),
  });

  if (!meetingResponse.ok) {
    const errorText = await meetingResponse.text();
    console.error("Zoom meeting creation error:", errorText);
    throw new Error("Falha ao criar reunião no Zoom. Tente reconectar sua conta.");
  }

  const meetingData = await meetingResponse.json();
  return {
    meeting_url: meetingData.join_url,
    meeting_id: meetingData.id.toString(),
    meeting_password: meetingData.password || "",
  };
}
```

#### 3. Atualizar chamada da função

De:
```typescript
if (platform === "zoom") {
  meetingResult = await createZoomMeeting(start_time, end_time, title, participant_email);
}
```

Para:
```typescript
if (platform === "zoom") {
  meetingResult = await createZoomMeeting(
    start_time, 
    end_time, 
    title, 
    participant_email,
    supabase,
    internalUserId
  );
}
```

---

## Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO OAUTH DO ZOOM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. CONEXÃO (única vez)                                        │
│   ━━━━━━━━━━━━━━━━━━━━━━                                        │
│   Usuário → Configurações → Integrações → Conectar Zoom         │
│                      │                                          │
│                      ▼                                          │
│             oauth-init (gera URL Zoom)                          │
│                      │                                          │
│                      ▼                                          │
│             Zoom autoriza → oauth-callback                      │
│                      │                                          │
│                      ▼                                          │
│             Tokens salvos em user_integrations                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   2. CRIAÇÃO DE REUNIÃO (cada vez)                              │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                              │
│   Usuário → Criar Tarefa → Configurar Reunião → Zoom            │
│                      │                                          │
│                      ▼                                          │
│             create-meeting Edge Function                        │
│                      │                                          │
│                      ▼                                          │
│   ┌─────────────────────────────────────────────────────┐       │
│   │ 1. Buscar tokens do usuário em user_integrations   │       │
│   │ 2. Se token expirado → refresh com refresh_token   │       │
│   │ 3. Usar access_token para criar reunião            │       │
│   │ 4. Se sem tokens → erro "Conecte sua conta Zoom"   │       │
│   └─────────────────────────────────────────────────────┘       │
│                      │                                          │
│                      ▼                                          │
│             Reunião criada na conta DO USUÁRIO                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## O que será removido

| Código Antigo | Status |
|---------------|--------|
| `ZOOM_ACCOUNT_ID` | ❌ Não será mais necessário |
| `grant_type=account_credentials` | ❌ Removido |
| Autenticação Server-to-Server | ❌ Removida |

---

## O que já funciona (sem alteração)

| Componente | Status |
|------------|--------|
| `oauth-init` (gerar URL Zoom) | ✅ Mantido |
| `oauth-callback` (salvar tokens) | ✅ Mantido |
| Tabela `user_integrations` | ✅ Mantida |
| Interface de conexão em Settings | ✅ Mantida |

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/create-meeting/index.ts` | Reescrever `createZoomMeeting` para usar OAuth do usuário |

---

## Requisito para o Usuário

Após esta alteração, cada usuário que quiser criar reuniões no Zoom precisará:

1. Ir em **Configurações → Integrações**
2. Clicar em **Conectar** ao lado do Zoom
3. Autorizar o aplicativo com sua conta Zoom pessoal

Depois disso, todas as reuniões serão criadas na conta Zoom desse usuário.

---

## Resultado Esperado

1. ✅ Erro `unsupported_grant_type` corrigido
2. ✅ Cada usuário usa sua própria conta Zoom
3. ✅ Tokens são armazenados e renovados automaticamente
4. ✅ `ZOOM_ACCOUNT_ID` não é mais necessário
5. ✅ Mensagem clara se o usuário não tiver conectado sua conta

