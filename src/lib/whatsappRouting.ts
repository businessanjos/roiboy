import { supabase } from "@/integrations/supabase/client";

// Cache provider by integration_id to avoid repeated lookups
const providerCache = new Map<string, { provider: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export type WhatsAppProvider = "uazapi" | "meta_official";

/**
 * Determine which provider an integration uses.
 * Returns "meta_official" for Meta Cloud API, "uazapi" for legacy.
 */
export async function getIntegrationProvider(integrationId: string): Promise<WhatsAppProvider> {
  const cached = providerCache.get(integrationId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.provider as WhatsAppProvider;
  }

  const { data } = await supabase
    .from("integrations")
    .select("config")
    .eq("id", integrationId)
    .single();

  const config = data?.config as Record<string, unknown> | null;
  const provider = (config?.provider as string) || "uazapi";
  
  providerCache.set(integrationId, { provider, ts: Date.now() });
  return provider as WhatsAppProvider;
}

/**
 * Invoke the correct edge function based on the integration's provider.
 * Uses "meta-manager" for Meta Cloud API, "uazapi-manager" for legacy.
 */
export async function invokeWhatsAppManager(
  integrationId: string | undefined,
  body: Record<string, unknown>
): Promise<{ data: any; error: any }> {
  let functionName = "uazapi-manager";

  if (integrationId) {
    try {
      const provider = await getIntegrationProvider(integrationId);
      if (provider === "meta_official") {
        functionName = "meta-manager";
      }
    } catch (err) {
      console.warn("[whatsapp-routing] Failed to detect provider, falling back to uazapi:", err);
    }
  }

  console.log(`[whatsapp-routing] Using ${functionName} for integration ${integrationId}`);
  return invokeWithRetry(functionName, body);
}

/**
 * Invoke a Supabase edge function with automatic retry on transient 503 errors
 * (SUPABASE_EDGE_RUNTIME_ERROR / boot failures). Uses exponential backoff.
 */
async function invokeWithRetry(
  functionName: string,
  body: Record<string, unknown>,
  maxAttempts = 3,
): Promise<{ data: any; error: any }> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await supabase.functions.invoke(functionName, { body });
    const err = result.error;
    if (!err) return result;

    // Detect transient edge-runtime errors (503 cold-start / boot failure)
    const msg = String(err?.message || "");
    const ctx: any = (err as any)?.context;
    const status = ctx?.status ?? ctx?.response?.status;
    const isTransient =
      status === 503 ||
      msg.includes("503") ||
      msg.includes("SUPABASE_EDGE_RUNTIME_ERROR") ||
      msg.includes("temporarily unavailable") ||
      msg.includes("Failed to fetch");

    if (!isTransient || attempt === maxAttempts) {
      return result;
    }

    lastError = err;
    const delayMs = 300 * Math.pow(2, attempt - 1); // 300ms, 600ms, 1200ms
    console.warn(
      `[whatsapp-routing] ${functionName} transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`,
      msg,
    );
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { data: null, error: lastError };
}

/**
 * Clear provider cache (e.g., when integration settings change)
 */
export function clearProviderCache(integrationId?: string) {
  if (integrationId) {
    providerCache.delete(integrationId);
  } else {
    providerCache.clear();
  }
}
