// Recomputa um KPI fixado rodando novamente a pergunta original
// via Gemini Pro (apenas a etapa analista, sem GPT) e atualiza o valor.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function buildSnapshot(admin: ReturnType<typeof createClient>, accountId: string) {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const sinceIso = since.toISOString();
  const [deals, stages, users, loss, goals, pipelines] = await Promise.all([
    admin.from("deals").select("id,value,received_value,status,stage_id,pipeline_id,source,responsible_user_id,sdr_user_id,won_at,lost_at,loss_reason_id,created_at").gte("created_at", sinceIso).eq("account_id", accountId).limit(5000),
    admin.from("deal_stages").select("id,name,pipeline_id,is_won,is_lost").eq("account_id", accountId),
    admin.from("users").select("id,name,is_active").eq("account_id", accountId),
    admin.from("deal_loss_reasons").select("id,name").eq("account_id", accountId),
    admin.from("sales_goals").select("*").eq("account_id", accountId).gte("created_at", sinceIso).limit(500),
    admin.from("pipelines").select("id,name,type").eq("account_id", accountId),
  ]);
  return { deals: deals.data, stages: stages.data, users: users.data, loss_reasons: loss.data, sales_goals: goals.data, pipelines: pipelines.data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await supabase.auth.getClaims(authHeader.slice(7));
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authUserId = claims.claims.sub;

    const { kpi_id } = await req.json();
    if (!kpi_id) return new Response(JSON.stringify({ error: "kpi_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: kpi } = await admin.from("sales_dashboard_pinned_kpis").select("*").eq("id", kpi_id).maybeSingle();
    if (!kpi) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (kpi.auth_user_id !== authUserId && !kpi.is_shared) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const snapshot = await buildSnapshot(admin, kpi.account_id);

    const sys = `Você é um analista de dados comercial. Recompute APENAS o KPI numérico desta pergunta a partir do snapshot. Responda em JSON puro: { "value": número, "value_text": "string formatada", "comparison": "string opcional", "trend": "up|down|flat" }. Nunca invente dados.`;
    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Pergunta: ${kpi.question}\nLabel: ${kpi.label}\nUnidade: ${kpi.unit ?? ""}\n\nSnapshot: ${JSON.stringify(snapshot).slice(0, 180000)}` },
        ],
      }),
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "AI error", detail: await r.text() }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const j = await r.json();
    let parsed: any = {};
    try { parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}"); } catch {}

    await admin.from("sales_dashboard_pinned_kpis").update({
      last_value: typeof parsed.value === "number" ? parsed.value : null,
      last_value_text: parsed.value_text ?? null,
      last_comparison: parsed.comparison ?? null,
      last_trend: parsed.trend ?? null,
      last_computed_at: new Date().toISOString(),
    }).eq("id", kpi_id);

    return new Response(JSON.stringify({ ok: true, ...parsed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
