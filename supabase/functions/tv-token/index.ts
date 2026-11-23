import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { deriveTvToken, hashTvToken, newNonce } from "../_shared/tvToken.ts";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Issue / rotate / revoke a TV key. Only TV managers. The raw key is never returned.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userDb.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: can } = await userDb.rpc("tv_can_manage", { _uid: u.user.id });
  if (!can) return json({ error: "forbidden" }, 403);

  let body: any; try { body = await req.json(); } catch { return json({ error: "invalid body" }, 400); }
  const slot = Number(body?.slot); const action = body?.action;
  if (!Number.isInteger(slot) || slot < 1 || slot > 20 || !["issue", "revoke"].includes(action)) return json({ error: "invalid input" }, 400);

  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (action === "revoke") {
    const { error } = await db.from("tv_screen_tokens").delete().eq("slot", slot);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }
  const secret = Deno.env.get("TV_TOKEN_SECRET"); if (!secret) return json({ error: "missing secret" }, 500);
  const nonce = newNonce();
  const token_hash = await hashTvToken(await deriveTvToken(secret, slot, nonce));
  const { error } = await db.from("tv_screen_tokens").upsert({ slot, nonce, token_hash, created_at: new Date().toISOString(), created_by: u.user.id, last_used_at: null }, { onConflict: "slot" });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
