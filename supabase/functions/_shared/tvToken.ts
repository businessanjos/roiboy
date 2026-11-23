/** TV keys: value = base64url(HMAC-SHA256(TV_TOKEN_SECRET, "slot:nonce")) (32 bytes); DB keeps only nonce + sha256(value). */
const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function deriveTvToken(secret: string, slot: number, nonce: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(`${slot}:${nonce}`)));
}
export async function hashTvToken(token: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function newNonce(): string {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Appends tv_token only to ROY Insights dashboard links; everything else is returned unchanged. */
export function withTvToken(url: string | null | undefined, token: string | null | undefined): string | null | undefined {
  if (!url || !token) return url;
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  if (!/\/insights\/[0-9a-f-]{36}$/i.test(u.pathname)) return url;
  if (!/(^|\.)iamroy\.app$|lovable\.app$|^localhost$/.test(u.hostname) || u.hostname === "eternum-luxe-hub.lovable.app") return url;
  u.searchParams.set("tv_token", token);
  return u.toString();
}

/** Start of the current rotation period: day 1 of the São Paulo month at 03:00 (UTC-3, no DST). */
export function rotationBoundary(now: Date): Date {
  const sp = new Date(now.getTime() - 3 * 3600_000);
  let y = sp.getUTCFullYear(), m = sp.getUTCMonth();
  let b = Date.UTC(y, m, 1, 6, 0, 0); // 03:00 SP = 06:00 UTC
  if (now.getTime() < b) { m -= 1; if (m < 0) { m = 11; y -= 1; } b = Date.UTC(y, m, 1, 6, 0, 0); }
  return new Date(b);
}
/** A key created before the current boundary must be replaced. */
export function needsRotation(createdAt: string | Date, now: Date): boolean {
  return new Date(createdAt).getTime() < rotationBoundary(now).getTime();
}
export const PREV_KEY_GRACE_MS = 7 * 24 * 3600_000;

type KeyRow = { slot: number; nonce: string; created_at: string };
/** Ensures every slot has a current key (creating or rotating monthly) and returns slot → nonce. */
export async function ensureTvKeys(db: any, secret: string, slots: number[], now = new Date()): Promise<Map<number, string>> {
  const { data } = await db.from("tv_screen_tokens").select("slot,nonce,created_at");
  const rows = new Map<number, KeyRow>((data ?? []).map((r: KeyRow) => [r.slot, r]));
  const out = new Map<number, string>();
  for (const slot of slots) {
    const r = rows.get(slot);
    if (r && !needsRotation(r.created_at, now)) { out.set(slot, r.nonce); continue; }
    const nonce = newNonce();
    const token_hash = await hashTvToken(await deriveTvToken(secret, slot, nonce));
    if (!r) {
      const { error } = await db.from("tv_screen_tokens").insert({ slot, nonce, token_hash, created_at: now.toISOString() });
      if (error) { const { data: x } = await db.from("tv_screen_tokens").select("nonce").eq("slot", slot).maybeSingle(); if (x) out.set(slot, x.nonce); continue; }
    } else {
      const prev_token_hash = await hashTvToken(await deriveTvToken(secret, slot, r.nonce));
      const { data: upd } = await db.from("tv_screen_tokens").update({
        nonce, token_hash, created_at: now.toISOString(), last_used_at: null,
        prev_nonce: r.nonce, prev_token_hash, prev_expires_at: new Date(now.getTime() + PREV_KEY_GRACE_MS).toISOString(),
      }).eq("slot", slot).eq("nonce", r.nonce).select("nonce");
      if (!upd?.length) { const { data: x } = await db.from("tv_screen_tokens").select("nonce").eq("slot", slot).maybeSingle(); if (x) out.set(slot, x.nonce); continue; }
    }
    out.set(slot, nonce);
  }
  return out;
}
