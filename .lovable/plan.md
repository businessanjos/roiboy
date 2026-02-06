

# Plano: Validação de API Key nas Edge Functions

## Visão Geral

Implementar um sistema de autenticação via API Key (`roy_sk_...`) nas Edge Functions existentes, permitindo que automações externas utilizem a chave gerada pelos administradores para acessar os endpoints com todas as permissões do cargo Admin.

---

## Arquitetura

### Fluxo de Autenticação

```text
1. Request chega com header: Authorization: Bearer roy_sk_a1b2c3...
   ↓
2. Edge Function extrai o token e calcula SHA-256 hash
   ↓
3. Busca na tabela api_keys por key_hash + is_active = true
   ↓
4. Se encontrado:
   - Atualiza last_used_at na api_keys
   - Insere log em api_key_logs (método, path, status, IP)
   - Retorna { userId, accountId } para a função usar
   ↓
5. Se não encontrado: retorna 401 Unauthorized
```

### Dual Auth Support

As Edge Functions suportarão dois métodos de autenticação:
1. **JWT do Supabase** (usuários logados no frontend)
2. **API Key Admin** (automações externas)

---

## Estrutura de Arquivos

```text
supabase/functions/
├── _shared/
│   └── api-key-auth.ts         (novo - helper de autenticação)
├── create-client/index.ts       (modificar - adicionar auth)
├── list-clients/index.ts        (modificar - adicionar auth)
├── get-client-by-phone/index.ts (modificar - refatorar auth)
└── ... (outras funções que precisarem)
```

---

## Arquivo 1: `supabase/functions/_shared/api-key-auth.ts` (novo)

Helper compartilhado para validar API Keys em qualquer Edge Function:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  accountId?: string;
  method?: "api_key" | "jwt";
  error?: string;
}

// Hash SHA-256 da chave
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Registrar log de uso da API Key
async function logApiKeyUsage(
  supabase: any,
  apiKeyId: string,
  req: Request,
  statusCode: number
): Promise<void> {
  const url = new URL(req.url);
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                    req.headers.get("cf-connecting-ip") || 
                    "unknown";

  await supabase.from("api_key_logs").insert({
    api_key_id: apiKeyId,
    method: req.method,
    path: url.pathname,
    status_code: statusCode,
    ip_address: ipAddress,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
  });

  // Atualizar last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKeyId);
}

// Validar API Key (roy_sk_...)
export async function validateApiKey(
  supabase: any,
  authHeader: string,
  req: Request
): Promise<AuthResult> {
  // Verificar formato Bearer
  if (!authHeader.startsWith("Bearer ")) {
    return { authenticated: false, error: "Invalid authorization format" };
  }

  const token = authHeader.replace("Bearer ", "");

  // Verificar se é uma API Key do ROY (prefixo roy_sk_)
  if (!token.startsWith("roy_sk_")) {
    return { authenticated: false, error: "Not an API key" };
  }

  // Calcular hash da chave
  const keyHash = await hashKey(token);

  // Buscar chave no banco
  const { data: apiKey, error } = await supabase
    .from("api_keys")
    .select("id, user_id, account_id")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !apiKey) {
    return { authenticated: false, error: "Invalid or revoked API key" };
  }

  // Log de uso (status será atualizado depois)
  // Nota: O log real será feito após a resposta
  
  return {
    authenticated: true,
    userId: apiKey.user_id,
    accountId: apiKey.account_id,
    method: "api_key",
  };
}

// Autenticação dual: tenta JWT primeiro, depois API Key
export async function authenticateRequest(
  req: Request,
  supabase: any
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || "";

  // Se não tem header de auth
  if (!authHeader) {
    return { authenticated: false, error: "No authorization header" };
  }

  // Se é uma API Key do ROY
  if (authHeader.includes("roy_sk_")) {
    return validateApiKey(supabase, authHeader, req);
  }

  // Tentar validar como JWT do Supabase
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { authenticated: false, error: "Invalid JWT token" };
  }

  // Buscar user_id e account_id da tabela users
  const { data: user } = await supabase
    .from("users")
    .select("id, account_id")
    .eq("auth_user_id", data.user.id)
    .single();

  if (!user) {
    return { authenticated: false, error: "User not found" };
  }

  return {
    authenticated: true,
    userId: user.id,
    accountId: user.account_id,
    method: "jwt",
  };
}

// Helper para criar resposta de erro 401
export function unauthorizedResponse(
  corsHeaders: Record<string, string>,
  message = "Unauthorized"
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export { logApiKeyUsage };
```

---

## Arquivo 2: Modificar `create-client/index.ts`

Adicionar autenticação dual (JWT + API Key):

```typescript
// Adicionar import no topo
import { authenticateRequest, unauthorizedResponse, logApiKeyUsage } from "../_shared/api-key-auth.ts";

// Após criar o cliente Supabase, adicionar:
const auth = await authenticateRequest(req, supabase);
if (!auth.authenticated) {
  return unauthorizedResponse(corsHeaders, auth.error);
}

// Usar auth.accountId em vez de payload.account_id (opcional, pode validar se coincidem)
const accountId = auth.accountId;

// Após a resposta de sucesso, logar uso se foi API Key:
if (auth.method === "api_key") {
  // Buscar apiKeyId para logging
  const { data: apiKey } = await supabase
    .from("api_keys")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .single();
  
  if (apiKey) {
    await logApiKeyUsage(supabase, apiKey.id, req, 201);
  }
}
```

---

## Arquivo 3: Modificar `list-clients/index.ts`

Substituir a autenticação atual por sessão (`x-session-token`) pela autenticação dual:

```typescript
// Remover validação por x-session-token
// Adicionar import do helper
import { authenticateRequest, unauthorizedResponse, logApiKeyUsage } from "../_shared/api-key-auth.ts";

// Substituir o bloco de autenticação atual por:
const auth = await authenticateRequest(req, supabase);
if (!auth.authenticated) {
  return unauthorizedResponse(corsHeaders, auth.error);
}

const accountId = auth.accountId!;
const userId = auth.userId!;

// Buscar role do usuário para filtros de permissão
const { data: userRole } = await supabase
  .from("users")
  .select("role")
  .eq("id", userId)
  .single();

const role = userRole?.role || "viewer";
```

---

## Arquivo 4: Refatorar `get-client-by-phone/index.ts`

Unificar para usar o helper de autenticação:

```typescript
// Remover a função validateApiKey interna
// Importar do helper compartilhado
import { authenticateRequest, unauthorizedResponse, logApiKeyUsage } from "../_shared/api-key-auth.ts";

// Substituir lógica de validação por:
const auth = await authenticateRequest(req, supabase);
if (!auth.authenticated) {
  // Fallback para x-api-key legacy (integrations table)
  const legacyApiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
  if (legacyApiKey) {
    // Manter lógica legacy temporariamente
  } else {
    return unauthorizedResponse(corsHeaders, auth.error);
  }
}
```

---

## Endpoints Prioritários para Atualização

| Endpoint | Uso Principal | Prioridade |
|----------|---------------|------------|
| `create-client` | Criar clientes via automação | Alta |
| `list-clients` | Listar clientes | Alta |
| `get-client-by-phone` | Buscar cliente por telefone | Alta |
| `sync-omie` | Sincronização ERP | Média |
| `bulk-ingest-messages` | Importação em massa | Média |

---

## Documentação da API

### Autenticação

Todas as requisições devem incluir o header de autorização:

```
Authorization: Bearer roy_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Exemplo de Uso

```bash
# Criar cliente
curl -X POST https://mtzoavtbtqflufyccern.supabase.co/functions/v1/create-client \
  -H "Authorization: Bearer roy_sk_sua_chave_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_e164": "+5511999999999",
    "full_name": "João Silva",
    "emails": ["joao@email.com"]
  }'

# Listar clientes
curl -X GET "https://mtzoavtbtqflufyccern.supabase.co/functions/v1/list-clients?limit=10" \
  -H "Authorization: Bearer roy_sk_sua_chave_aqui"

# Buscar cliente por telefone
curl -X GET "https://mtzoavtbtqflufyccern.supabase.co/functions/v1/get-client-by-phone?phone_e164=+5511999999999" \
  -H "Authorization: Bearer roy_sk_sua_chave_aqui"
```

---

## Resposta de Erros

| Status | Descrição |
|--------|-----------|
| 401 | Chave inválida ou revogada |
| 403 | Sem permissão para o recurso |
| 400 | Payload inválido |
| 500 | Erro interno |

---

## Resumo das Modificações

| Arquivo | Ação |
|---------|------|
| `_shared/api-key-auth.ts` | Novo - Helper de autenticação |
| `create-client/index.ts` | Adicionar autenticação dual |
| `list-clients/index.ts` | Substituir auth por sessão |
| `get-client-by-phone/index.ts` | Refatorar para usar helper |
| Documentação API | Atualizar com exemplos |

---

## Segurança

1. **Hash SHA-256**: Chaves nunca são armazenadas em texto puro
2. **Logs de Auditoria**: Cada uso é registrado com IP, método e endpoint
3. **Revogação Imediata**: Ao revogar uma chave, todas as requisições subsequentes falham
4. **Rate Limiting**: (Futuro) Adicionar limitação de requisições por chave
5. **Escopo por Account**: Cada chave só acessa dados da conta do admin que a gerou

