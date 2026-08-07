// Public portal for traffic agencies to submit their weekly report.
// No JWT required — the token in the URL is the auth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number => Math.max(0, Math.round(num(v) ?? 0));
const text = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, 8000) : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const token = url.searchParams.get("token") || "";
    if (!token) return json({ error: "Token obrigatório" }, 400);

    const { data: agency } = await admin
      .from("traffic_agencies")
      .select("id, account_id, name, color, is_active")
      .eq("public_report_token", token)
      .maybeSingle();

    if (!agency) return json({ error: "Link inválido ou expirado" }, 404);
    if (agency.is_active === false) return json({ error: "Cadastro inativo. Contate o time de marketing." }, 403);

    if (req.method === "GET" || action === "get") {
      const { data: reports } = await admin
        .from("agency_weekly_reports")
        .select("id, week_start, week_end, spend, leads_total, leads_mql, cpl")
        .eq("agency_id", agency.id)
        .order("week_start", { ascending: false })
        .limit(12);

      return json({
        agency: { name: agency.name, color: agency.color },
        reports: reports ?? [],
      });
    }

    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const b = await req.json().catch(() => ({} as Record<string, unknown>));

    const week_start = text(b.week_start);
    const week_end = text(b.week_end);
    if (!week_start || !week_end) return json({ error: "Informe o período da semana" }, 400);
    if (week_end < week_start) return json({ error: "A data final deve ser posterior à inicial" }, 400);

    const payload = {
      account_id: agency.account_id,
      agency_id: agency.id,
      week_start,
      week_end,
      spend: num(b.spend) ?? 0,
      impressions: int(b.impressions),
      link_clicks: int(b.link_clicks),
      page_views: int(b.page_views),
      leads_total: int(b.leads_total),
      leads_mql: int(b.leads_mql),
      ctr: num(b.ctr),
      connect_rate: num(b.connect_rate),
      mql_rate: num(b.mql_rate),
      lp_conversion_rate: num(b.lp_conversion_rate),
      cpl: num(b.cpl),
      cost_per_mql: num(b.cost_per_mql),
      cpm: num(b.cpm),
      best_creative_name: text(b.best_creative_name),
      best_creative_spend: num(b.best_creative_spend),
      best_creative_mqls: num(b.best_creative_mqls) == null ? null : int(b.best_creative_mqls),
      best_creative_cpa: num(b.best_creative_cpa),
      best_creative_url: text(b.best_creative_url),
      best_creative_notes: text(b.best_creative_notes),
      comparison_notes: text(b.comparison_notes),
      evolution_notes: text(b.evolution_notes),
      bottleneck_notes: text(b.bottleneck_notes),
      team_actions: text(b.team_actions),
      client_dependencies: text(b.client_dependencies),
      summary: text(b.summary),
      submitted_via_public_link: true,
      submitted_by_name: text(b.submitted_by_name),
    };

    const { data, error } = await admin
      .from("agency_weekly_reports")
      .upsert(payload, { onConflict: "agency_id,week_start" })
      .select("id, week_start, week_end")
      .single();

    if (error) return json({ error: error.message }, 400);

    return json({ ok: true, report: data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
