// Reprocessa snapshots de Instagram já salvos: invoca a função
// `instagram-public-snapshot` para cada (clientId, username) cacheado,
// fazendo com que os thumbnails sejam recalculados com o fallback novo.
//
// Body opcional:
//   { clientId?: string }   → reprocessa apenas esse cliente
//   { accountId?: string }  → reprocessa todos os snapshots de uma conta
//   { limit?: number }      → limita a quantidade processada (default 200)
//   { delayMs?: number }    → pausa entre chamadas (default 800ms p/ não estourar HikerAPI)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { clientId, accountId, limit = 200, delayMs = 800 } = body || {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("client_instagram_snapshots")
      .select("client_id, username, account_id, last_synced_at")
      .order("last_synced_at", { ascending: true })
      .limit(Math.min(Number(limit) || 200, 1000));

    if (clientId) q = q.eq("client_id", clientId);
    else if (accountId) q = q.eq("account_id", accountId);

    const { data: rows, error } = await q;
    if (error) throw error;

    const targets = (rows || []).filter((r: any) => r.client_id && r.username);
    const results: any[] = [];

    for (const t of targets) {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke(
          "instagram-public-snapshot",
          { body: { username: t.username, clientId: t.client_id } },
        );
        if (invokeErr || (data as any)?.error) {
          results.push({
            clientId: t.client_id,
            username: t.username,
            ok: false,
            error: (data as any)?.error || invokeErr?.message,
          });
        } else {
          results.push({ clientId: t.client_id, username: t.username, ok: true });
        }
      } catch (e: any) {
        results.push({ clientId: t.client_id, username: t.username, ok: false, error: e.message });
      }
      if (delayMs > 0) await sleep(Number(delayMs));
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("reprocess-instagram-snapshots error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
