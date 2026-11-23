// TV proxy: lets a TV opened with ?tv_token render the normal Insights screen.
// Only reads pass (GET/HEAD on REST, POST only to STABLE/IMMUTABLE RPCs); the TV account session never leaves the server.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { hashTvToken } from "../_shared/tvToken.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PASSWORD = Deno.env.get("TV_ACCOUNT_PASSWORD") ?? "";
const EMAIL = "tv-escritorio@iamroy.app";
const TEMPLATE_AUTH_ID = "eac2ef58-b79c-4d0a-9a7f-e1508dbcd16d"; // conta que as TVs usavam logadas (perfil de visualização)
const cors = { ...baseCors, "Access-Control-Allow-Headers": `${baseCors["Access-Control-Allow-Headers"]}, x-tv-token, accept-profile, content-profile, prefer, range, range-unit, x-client-info` , "Access-Control-Expose-Headers": "content-range, content-profile" };
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

let mem: { access: string; exp: number; user: unknown } | null = null;
const rpcCache = new Map<string, boolean>();

async function setStatus(status: string, last_error: string | null, extra: Record<string, unknown> = {}) {
  await admin.from("tv_proxy_session").upsert({ id: 1, status, last_error, updated_at: new Date().toISOString(), ...extra });
}

async function ensureAccount(): Promise<string> {
  const { data: u } = await admin.from("users").select("auth_user_id").eq("email", EMAIL).maybeSingle();
  if (u?.auth_user_id) return u.auth_user_id;
  const { data: tpl } = await admin.from("users").select("id, account_id, role, team_role_id, is_also_admin").eq("auth_user_id", TEMPLATE_AUTH_ID).single();
  const { data: created, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { is_team_member: "true", full_name: "TV Escritório" } });
  if (error || !created.user) throw new Error("create_failed: " + error?.message);
  const { data: nu } = await admin.from("users").insert({ auth_user_id: created.user.id, account_id: tpl!.account_id, email: EMAIL, name: "TV Escritório", role: tpl!.role, team_role_id: tpl!.team_role_id, is_also_admin: tpl!.is_also_admin, is_active: true }).select("id").single();
  const { data: roles } = await admin.from("user_team_roles").select("team_role_id").eq("user_id", tpl!.id);
  if (roles?.length) await admin.from("user_team_roles").insert(roles.map((r) => ({ user_id: nu!.id, team_role_id: r.team_role_id })));
  const { data: secs } = await admin.from("user_sector_access").select("account_id, sector_id, role_in_sector, is_active").eq("user_id", tpl!.id);
  if (secs?.length) await admin.from("user_sector_access").insert(secs.map((s) => ({ ...s, user_id: nu!.id })));
  return created.user.id;
}

async function authCall(path: string, body: unknown) {
  const r = await fetch(`${URL_}/auth/v1/${path}`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? j : null;
}

/** Access token for the TV account: memory → stored session → refresh → password (last resort). */
async function getAccess(): Promise<string> {
  const now = Date.now() / 1000;
  if (mem && mem.exp - now > 120) return mem.access;
  const { data: s } = await admin.from("tv_proxy_session").select("*").eq("id", 1).maybeSingle();
  const exp = s?.expires_at ? new Date(s.expires_at).getTime() / 1000 : 0;
  if (s?.access_token && exp - now > 120) { mem = { access: s.access_token, exp, user: null }; return s.access_token; }
  let sess = s?.refresh_token ? await authCall("token?grant_type=refresh_token", { refresh_token: s.refresh_token }) : null;
  if (!sess) {
    await ensureAccount();
    sess = await authCall("token?grant_type=password", { email: EMAIL, password: PASSWORD });
    if (!sess) { await setStatus("login_failed", "Login da conta de TV recusado (senha trocada ou conta bloqueada)"); throw new Error("login_failed"); }
    await setStatus("ok", null, { last_login_at: new Date().toISOString() });
  }
  const e = sess.expires_at ?? Math.floor(now + (sess.expires_in ?? 3600));
  await setStatus("ok", null, { auth_user_id: sess.user?.id, access_token: sess.access_token, refresh_token: sess.refresh_token, expires_at: new Date(e * 1000).toISOString() });
  mem = { access: sess.access_token, exp: e, user: sess.user };
  return sess.access_token;
}

async function rpcAllowed(fn: string) {
  if (!/^[a-z0-9_]{1,63}$/i.test(fn)) return false;
  if (rpcCache.has(fn)) return rpcCache.get(fn)!;
  const { data } = await admin.rpc("tv_proxy_rpc_is_readonly", { _fn: fn });
  rpcCache.set(fn, data === true);
  return data === true;
}

let lastUsed = 0;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? cors["Access-Control-Allow-Headers"], "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS" } });
  const tok = req.headers.get("x-tv-token") ?? "";
  if (tok.length < 40 || tok.length > 100) return json({ error: "tv_token_invalid" }, 403);
  const th = await hashTvToken(tok);
  let { data: key } = await admin.from("tv_screen_tokens").select("slot").eq("token_hash", th).maybeSingle();
  if (!key) { // previous key stays valid for 7 days after the monthly rotation
    const { data: prev } = await admin.from("tv_screen_tokens").select("slot").eq("prev_token_hash", th).gt("prev_expires_at", new Date().toISOString()).maybeSingle();
    key = prev;
  }
  if (!key) return json({ error: "tv_token_invalid" }, 403);
  if (Date.now() - lastUsed > 60_000) { lastUsed = Date.now(); admin.from("tv_screen_tokens").update({ last_used_at: new Date().toISOString() }).eq("slot", key.slot).then(() => {}); }

  const u = new URL(req.url);
  const path = u.pathname.replace(/^.*?\/tv-proxy/, "");
  const m = req.method;
  let access: string;
  try { access = await getAccess(); } catch { return json({ error: "tv_account_no_access" }, 503); }

  if (path === "/auth/v1/user" && m === "GET") {
    const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${access}` } });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
  }
  let ok = false;
  if (path.startsWith("/rest/v1/rpc/")) ok = (m === "POST" || m === "GET" || m === "HEAD") && await rpcAllowed(path.slice(13));
  else if (path.startsWith("/rest/v1/")) ok = m === "GET" || m === "HEAD";
  else if (path.startsWith("/storage/v1/object/")) ok = m === "GET" || m === "HEAD";
  if (!ok) return json({ error: "tv_read_only", message: "Modo TV: somente leitura" }, 403);

  const h = new Headers();
  for (const k of ["accept", "accept-profile", "content-profile", "content-type", "prefer", "range", "range-unit"]) { const v = req.headers.get(k); if (v) h.set(k, v); }
  // never allow PostgREST writes via Prefer tricks; force read-only tx for RPC POST
  if (h.get("prefer")?.match(/tx=commit|resolution/)) h.delete("prefer");
  h.set("apikey", ANON); h.set("Authorization", `Bearer ${access}`);
  const r = await fetch(`${URL_}${path}${u.search}`, { method: m, headers: h, body: m === "POST" ? await req.text() : undefined });
  const out = new Headers(cors);
  for (const k of ["content-type", "content-range", "content-profile"]) { const v = r.headers.get(k); if (v) out.set(k, v); }
  return new Response(r.body, { status: r.status, headers: out });
});
