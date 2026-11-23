/**
 * TV key boot (?tv_token on /insights/<id>, no saved session): routes every backend call through the
 * read-only `tv-proxy` and seeds a placeholder session for the dedicated TV account, so the normal
 * Insights screen renders unchanged. The real session token stays on the server.
 */
const PROJECT = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const BASE = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const STORAGE_KEY = `sb-${PROJECT}-auth-token`;
const PROXY = `${BASE}/functions/v1/tv-proxy`;
const SS_KEY = "roy-tv-token";
export const TV_PLACEHOLDER = "tv-proxy-session";

export type TvBootResult = "off" | "ok" | "invalid" | "no_access" | "error";

export function readTvToken(pathname: string, search: string): string | null {
  const fromUrl = new URLSearchParams(search).get("tv_token");
  if (fromUrl && /^\/insights\/[0-9a-f-]{36}$/i.test(pathname)) return fromUrl;
  return null;
}

/** Rewrites a backend URL to the proxy; returns null for anything that must not be proxied. */
export function proxiedUrl(url: string): string | null {
  if (!url.startsWith(BASE + "/")) return null;
  const rest = url.slice(BASE.length);
  if (/^\/(rest|auth|storage|functions)\/v1\//.test(rest)) return PROXY + rest;
  return null;
}

function hasRealSession(): boolean {
  try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return !!s?.access_token && s.access_token !== TV_PLACEHOLDER; } catch { return false; }
}

function showBlock(kind: "invalid" | "no_access") {
  const msg = kind === "invalid"
    ? ["Chave de TV inválida ou cancelada", "Gere uma nova em Configurações > TVs."]
    : ["Conta de TV sem acesso", "Verifique em Configurações > TVs."];
  let el = document.getElementById("tv-block");
  if (!el) { el = document.createElement("div"); el.id = "tv-block"; document.body.appendChild(el); }
  el.setAttribute("style", "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0b0b0c;color:#f5f5f5;font-family:sans-serif;text-align:center;padding:32px");
  el.innerHTML = `<div style="font-size:32px;font-weight:600">${msg[0]} — ${msg[1].replace(/^V/, "v")}</div>`;
}

export async function bootTvToken(): Promise<TvBootResult> {
  const token = readTvToken(location.pathname, location.search) ?? sessionStorage.getItem(SS_KEY);
  if (!token || hasRealSession()) { if (!hasRealSession()) localStorage.getItem(STORAGE_KEY)?.includes(TV_PLACEHOLDER) && localStorage.removeItem(STORAGE_KEY); return "off"; }
  sessionStorage.setItem(SS_KEY, token);
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const target = proxiedUrl(url);
    if (!target) return orig(input as any, init);
    const req = input instanceof Request ? input : null;
    const headers = new Headers(init?.headers ?? req?.headers);
    headers.delete("authorization"); headers.set("apikey", ANON); headers.set("x-tv-token", token);
    return orig(target, { method: init?.method ?? req?.method, body: init?.body, headers, signal: init?.signal }).then((r) => {
      if (r.status === 403 || r.status === 503) r.clone().json().then((j) => {
        if (j?.error === "tv_token_invalid") showBlock("invalid");
        if (j?.error === "tv_account_no_access") showBlock("no_access");
      }).catch(() => {});
      return r;
    });
  };
  try {
    const r = await window.fetch(`${BASE}/auth/v1/user`);
    const j = await r.json().catch(() => null);
    if (j?.error === "tv_token_invalid") { showBlock("invalid"); return "invalid"; }
    if (j?.error === "tv_account_no_access") { showBlock("no_access"); return "no_access"; }
    if (!r.ok || !j?.id) return "error";
    const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: TV_PLACEHOLDER, refresh_token: TV_PLACEHOLDER, token_type: "bearer", expires_in: exp, expires_at: exp, user: j }));
    (window as any).__ROY_TV_MODE__ = true;
    return "ok";
  } catch { return "error"; }
}
