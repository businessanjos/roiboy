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

async function refreshForProfile(supabase: any, accountId: string, profileId: string, source: "cron" | "manual") {
  const ctx = await fetchInstagramContext(supabase, accountId, profileId);
  if (!ctx?.profile) return { accountId, profileId, skipped: true, reason: "no_active_profile" };

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
    profile_id: profileId,
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

  if (error) return { accountId, profileId, error: error.message };
  return { accountId, profileId, username: ctx.profile.username, ok: true, posts: top.length };
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
    // Resolve a lista de (accountId, profileId) a processar.
    // Estratégia:
    // 1) Se profileId vier no body → processa só esse perfil.
    // 2) Se accountId vier no body → processa TODOS os perfis ativos dessa conta.
    // 3) Caso contrário (cron) → processa TODOS os perfis ativos de TODAS as contas.
    let targets: Array<{ accountId: string; profileId: string }> = [];

    if (body?.profileId) {
      const { data } = await supabase
        .from("instagram_profiles")
        .select("id, account_id")
        .eq("id", body.profileId)
        .maybeSingle();
      if (data?.id && data.account_id) {
        targets = [{ accountId: data.account_id, profileId: data.id }];
      }
    } else if (body?.accountId) {
      const { data } = await supabase
        .from("instagram_profiles")
        .select("id, account_id")
        .eq("account_id", body.accountId)
        .eq("is_active", true);
      targets = (data || []).map((r: any) => ({ accountId: r.account_id, profileId: r.id }));
    } else {
      const { data } = await supabase
        .from("instagram_profiles")
        .select("id, account_id")
        .eq("is_active", true);
      targets = (data || []).map((r: any) => ({ accountId: r.account_id, profileId: r.id }));
    }

    const results = await Promise.all(
      targets.map((t) =>
        refreshForProfile(supabase, t.accountId, t.profileId, source).catch((e) => ({
          accountId: t.accountId,
          profileId: t.profileId,
          error: String(e),
        })),
      ),
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
