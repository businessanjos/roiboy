// @ts-nocheck
// Fallback do webhook: se em 5 minutos a ligação não voltou, busca no Call Ryka
// pelo external_ref e completa o registro. Pode ser chamada pelo app ou por cron.
import { createClient } from "npm:@supabase/supabase-js@2";
import { RYKA_ENGINE, getRykaConfig, persistRykaCall, rykaFetch } from "../_shared/ryka-call.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function syncAccount(supabase: any, accountId: string, callLogId?: string | null) {
  const config = await getRykaConfig(supabase, accountId);
  if (!config) return { pending: 0, updated: 0 };

  let query = supabase
    .from("threecplus_call_logs")
    .select("id, call_id, started_at")
    .eq("account_id", accountId)
    .eq("engine", RYKA_ENGINE)
    .in("status", ["dialing", "in_progress"])
    .order("started_at", { ascending: false })
    .limit(100);
  if (callLogId) query = query.eq("id", callLogId);
  else query = query.lt("started_at", new Date(Date.now() - 5 * 60_000).toISOString());

  const { data: pending } = await query;
  let updated = 0;

  for (const row of pending || []) {
    const path = row.call_id
      ? `/calls/${encodeURIComponent(row.call_id)}`
      : `/calls?external_ref=${encodeURIComponent(row.id)}&external_source=${encodeURIComponent(config.externalSource)}`;
    const { status, body } = await rykaFetch(config.apiToken, path);
    if (status !== 200) continue;
    const payload = body?.data ?? body;
    const call = Array.isArray(payload) ? payload[0] : payload;
    if (!call?.id) continue;
    const result = await persistRykaCall(supabase, accountId, { external_ref: row.id, ...call }, config.apiToken);
    if (result.updated) updated++;
  }

  return { pending: pending?.length || 0, updated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const cronSecret = req.headers.get("x-cron-secret");
    let accountId: string | null = null;
    let trusted = Boolean(cronSecret && cronSecret === Deno.env.get("THREECPLUS_CRON_SECRET"));

    if (!trusted) {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
      const bearer = authHeader.slice(7);
      if (bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        trusted = true;
        accountId = body?.account_id ?? null;
      } else {
        const { data: claims } = await supabase.auth.getClaims(bearer);
        const authUserId = claims?.claims?.sub;
        if (!authUserId) return json({ error: "Não autorizado" }, 401);
        const { data: userData } = await supabase
          .from("users")
          .select("account_id")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        if (!userData) return json({ error: "Usuário não encontrado" }, 404);
        accountId = userData.account_id;
      }
    } else {
      accountId = body?.account_id ?? null;
    }

    if (accountId) {
      return json({ success: true, ...(await syncAccount(supabase, accountId, body?.call_log_id ?? null)) });
    }

    const { data: rows } = await supabase
      .from("integrations")
      .select("account_id")
      .eq("type", RYKA_ENGINE)
      .eq("status", "connected");
    const results: unknown[] = [];
    for (const row of rows || []) {
      results.push({ account_id: row.account_id, ...(await syncAccount(supabase, row.account_id, null)) });
    }
    return json({ success: true, results });
  } catch (error) {
    console.error("[ryka-call-sync] fatal:", error);
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
});
