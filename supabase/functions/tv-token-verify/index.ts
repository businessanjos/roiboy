import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hashTvToken } from "../_shared/tvToken.ts";

// Central de Tráfego checks a ROY TV key. Requires x-central-secret; failed attempts limited per IP.
const cors = { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, x-central-secret` };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MAX_FAILS = 20, WINDOW_S = 600;

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const expected = Deno.env.get("TV_CENTRAL_SECRET") ?? "";
  if (!expected || !safeEq(req.headers.get("x-central-secret") ?? "", expected)) return json({ error: "unauthorized" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const { data: allowed } = await db.rpc("check_rate_limit", { p_identifier: ip, p_action: "tv_token_verify_fail", p_max_requests: MAX_FAILS, p_window_seconds: WINDOW_S });
  if (allowed === false) return json({ valid: false, error: "too_many_attempts" }, 429);

  let token = "";
  try { const b = await req.json(); token = typeof b?.token === "string" ? b.token : ""; } catch { /* invalid */ }
  const fail = async () => { await db.from("rate_limit_logs").insert({ identifier: ip, action: "tv_token_verify_fail" }); return json({ valid: false }); };
  if (token.length < 40 || token.length > 100) return fail();

  const th = await hashTvToken(token);
  let { data: key } = await db.from("tv_screen_tokens").select("slot").eq("token_hash", th).maybeSingle();
  if (!key) {
    const { data: prev } = await db.from("tv_screen_tokens").select("slot").eq("prev_token_hash", th).gt("prev_expires_at", new Date().toISOString()).maybeSingle();
    key = prev;
  }
  if (!key) return fail();
  await db.from("tv_screen_tokens").update({ last_used_at: new Date().toISOString() }).eq("slot", key.slot);
  const { data: sc } = await db.from("tv_screens").select("name").eq("slot", key.slot).maybeSingle();
  return json({ valid: true, slot: key.slot, tv_name: sc?.name ?? `TV ${key.slot}` });
});
