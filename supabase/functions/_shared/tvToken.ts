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
