// Recalcula e persiste os Top 3 formatos / temas / hashtags por perfil ativo de Instagram.
// Pode ser chamada:
//   - Pelo cron diário (sem body) → processa todos os perfis ativos.
//   - Pelo botão "Atualizar agora" no painel de Persona (body: { profileId } ou { accountId }) → processa apenas o perfil correspondente.

import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchInstagramContext } from "../_shared/marketing-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function tally(values: (string | null | undefined)[]) {
  const map: Record<string, { count: number }> = {};
  values.forEach((v) => {
    const k = (v || "").toString().trim();
    if (!k) return;
    map[k] = map[k] || { count: 0 };
    map[k].count += 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([label, v]) => ({ label, count: v.count }));
}

async function refreshForAccount(supabase: any, accountId: string, source: "cron" | "manual") {
  const ctx = await fetchInstagramContext(supabase, accountId);
  if (!ctx?.profile) return { accountId, skipped: true, reason: "no_active_profile" };

  // Buscar profile_id real (fetchInstagramContext não devolve)
  const { data: profile } = await supabase
    .from("instagram_profiles")
    .select("id")
    .eq("account_id", accountId)
    .eq("username", ctx.profile.username)
    .eq("is_active", true)
    .maybeSingle();
  if (!profile?.id) return { accountId, skipped: true, reason: "profile_not_found" };

  const top = (ctx.topPosts || []).slice(0, 20);
  const formats = tally(top.map((p) => p.post_type)).map((f) => ({
    label: f.label,
    count: f.count,
    avg_engagement:
      ctx.formatStats.find((s) => s.post_type === f.label)?.avg_engagement || 0,
  }));
  const themes = tally(top.map((p) => p.theme));
  const hashtags = (ctx.topHashtags || []).slice(0, 3).map((h) => ({
    label: h.tag,
    count: h.uses,
    avg_engagement: h.avg_engagement,
  }));

  const payload = {
    account_id: accountId,
    profile_id: profile.id,
    username: ctx.profile.username,
    formats,
    themes,
    hashtags,
    posts_analyzed: top.length,
    computed_at: new Date().toISOString(),
    source,
  };

  const { error } = await supabase
    .from("instagram_highlights_cache")
    .upsert(payload, { onConflict: "profile_id" });

  if (error) return { accountId, error: error.message };
  return { accountId, ok: true, posts: top.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try {
    body = req.method === "POST" ? await req.json() : {};
  } catch (_) { /* body opcional */ }

  const source: "cron" | "manual" = body?.source === "manual" ? "manual" : "cron";

  try {
    let accountIds: string[] = [];

    if (body?.accountId) {
      accountIds = [body.accountId];
    } else if (body?.profileId) {
      const { data } = await supabase
        .from("instagram_profiles")
        .select("account_id")
        .eq("id", body.profileId)
        .maybeSingle();
      if (data?.account_id) accountIds = [data.account_id];
    } else {
      // Todos os accounts com pelo menos um perfil ativo
      const { data } = await supabase
        .from("instagram_profiles")
        .select("account_id")
        .eq("is_active", true);
      accountIds = Array.from(new Set((data || []).map((r: any) => r.account_id))).filter(Boolean);
    }

    const results = await Promise.all(
      accountIds.map((id) => refreshForAccount(supabase, id, source).catch((e) => ({ accountId: id, error: String(e) }))),
    );

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("refresh-instagram-highlights error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
