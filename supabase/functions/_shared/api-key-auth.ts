import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  accountId?: string;
  apiKeyId?: string;
  method?: "api_key" | "jwt" | "legacy_api_key";
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
export async function logApiKeyUsage(
  supabase: SupabaseClient,
  apiKeyId: string,
  req: Request,
  statusCode: number
): Promise<void> {
  try {
    const url = new URL(req.url);
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
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
  } catch (error) {
    console.error("Error logging API key usage:", error);
  }
}

// Validar API Key (roy_sk_...)
export async function validateApiKey(
  supabase: SupabaseClient,
  authHeader: string
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

  return {
    authenticated: true,
    userId: apiKey.user_id,
    accountId: apiKey.account_id,
    apiKeyId: apiKey.id,
    method: "api_key",
  };
}

// Validar legacy API key (x-api-key para integrations)
export async function validateLegacyApiKey(
  supabase: SupabaseClient,
  apiKey: string
): Promise<AuthResult> {
  if (!apiKey || apiKey.length < 16 || apiKey.length > 128) {
    return { authenticated: false, error: "Invalid API key format" };
  }

  // Check for liberty type integration
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_id, config")
    .eq("type", "liberty")
    .eq("status", "connected")
    .maybeSingle();

  if (integration) {
    const config = integration.config as Record<string, string> | null;
    if (config?.api_key && config.api_key === apiKey) {
      return {
        authenticated: true,
        accountId: integration.account_id,
        method: "legacy_api_key",
      };
    }
  }

  // Check for whatsapp type integration
  const { data: whatsappIntegration } = await supabase
    .from("integrations")
    .select("account_id, config")
    .eq("type", "whatsapp")
    .eq("status", "connected")
    .maybeSingle();

  if (whatsappIntegration) {
    const config = whatsappIntegration.config as Record<string, string> | null;
    if (config?.api_key && config.api_key === apiKey) {
      return {
        authenticated: true,
        accountId: whatsappIntegration.account_id,
        method: "legacy_api_key",
      };
    }
  }

  return { authenticated: false, error: "Invalid API key" };
}

// Autenticação dual: tenta API Key primeiro, depois JWT
export async function authenticateRequest(
  req: Request,
  supabase: SupabaseClient
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || "";

  // Se não tem header de auth
  if (!authHeader) {
    return { authenticated: false, error: "No authorization header" };
  }

  // Se é uma API Key do ROY
  if (authHeader.includes("roy_sk_")) {
    return validateApiKey(supabase, authHeader);
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

// Autenticação com suporte a legacy (x-api-key header)
export async function authenticateRequestWithLegacy(
  req: Request,
  supabase: SupabaseClient
): Promise<AuthResult> {
  // Primeiro tenta auth normal (Authorization header)
  const authHeader = req.headers.get("Authorization") || "";
  
  if (authHeader) {
    const result = await authenticateRequest(req, supabase);
    if (result.authenticated) {
      return result;
    }
  }

  // Fallback para x-api-key legacy
  const url = new URL(req.url);
  const legacyApiKey =
    req.headers.get("x-api-key") || url.searchParams.get("api_key");

  if (legacyApiKey) {
    return validateLegacyApiKey(supabase, legacyApiKey);
  }

  return { authenticated: false, error: "No valid authentication provided" };
}

// Helper para criar resposta de erro 401
export function unauthorizedResponse(
  corsHeaders: Record<string, string>,
  message = "Unauthorized"
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
