// Shared helpers to keep Meta long-lived tokens fresh.
const GRAPH_API = "https://graph.facebook.com/v21.0";

// Refresh threshold: renew when the token expires within this window.
export const REFRESH_WINDOW_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

export interface RefreshResult {
  token?: string;
  expiresAt?: string | null;
  error?: string;
}

/** Exchanges a (still valid) long-lived token for a fresh one. */
export async function exchangeLongLivedToken(token: string): Promise<RefreshResult> {
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appId || !appSecret) return { error: "META_APP_ID/META_APP_SECRET não configurados" };

  try {
    const url =
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.error) {
      return { error: json.error?.message || `HTTP ${res.status}` };
    }
    const expiresIn = Number(json.expires_in ?? 0);
    return {
      token: json.access_token as string,
      expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function isExpiredTokenError(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("access token") ||
    m.includes("oauthexception") ||
    m.includes("session is invalid") ||
    m.includes("session has expired") ||
    m.includes("expired")
  );
}

interface ProfileLike {
  id: string;
  username?: string | null;
  meta_access_token?: string | null;
  token_expires_at?: string | null;
}

/**
 * Returns a usable token for the profile, refreshing (and persisting) it when
 * it is missing an expiry, close to expiring, or when `force` is set.
 */
export async function ensureFreshToken(
  supabase: any,
  profile: ProfileLike,
  opts: { force?: boolean } = {},
): Promise<{ token: string | null; refreshed: boolean; error?: string }> {
  const current = profile.meta_access_token || null;
  if (!current) return { token: null, refreshed: false, error: "Credenciais Meta ausentes" };

  const expiresAt = profile.token_expires_at ? new Date(profile.token_expires_at).getTime() : null;
  const needsRefresh =
    opts.force || expiresAt === null || expiresAt - Date.now() < REFRESH_WINDOW_MS;

  if (!needsRefresh) return { token: current, refreshed: false };

  const result = await exchangeLongLivedToken(current);
  if (result.error || !result.token) {
    // Token cannot be renewed (usually revoked / user logged out): flag for reconnection.
    await supabase
      .from("instagram_profiles")
      .update({
        sync_error: `Token Meta expirado — reconecte em "Configurar Meta API" (${result.error ?? "falha ao renovar"})`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    return { token: opts.force ? null : current, refreshed: false, error: result.error };
  }

  await supabase
    .from("instagram_profiles")
    .update({
      meta_access_token: result.token,
      token_expires_at: result.expiresAt,
      sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  console.log(`Meta token renovado para ${profile.username ?? profile.id}, expira em ${result.expiresAt}`);
  return { token: result.token, refreshed: true };
}
