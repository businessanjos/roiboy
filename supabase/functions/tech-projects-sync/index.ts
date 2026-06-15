import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[tech-projects-sync] ${s}${d ? " " + JSON.stringify(d) : ""}`);

interface MetricsPayload {
  mrr_cents?: number;
  arr_cents?: number;
  active_subscriptions?: number;
  new_subscriptions?: number;
  churned_subscriptions?: number;
  revenue_last_30d_cents?: number;
  ai_tokens_30d?: number;
  ai_cost_cents_30d?: number;
  currency?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const project_id: string | undefined = body.project_id;
    const sync_all: boolean = !!body.sync_all;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Auth (skip when called from cron with service role)
    const auth = req.headers.get("Authorization");
    if (!sync_all) {
      if (!auth) throw new Error("missing auth");
      const { data: userData } = await supabase.auth.getUser(
        auth.replace("Bearer ", ""),
      );
      if (!userData?.user) throw new Error("invalid user");
    }

    let query = supabase.from("tech_projects").select("*");
    if (project_id) query = query.eq("id", project_id);
    else if (sync_all) query = query.not("metrics_endpoint", "is", null);
    else throw new Error("project_id or sync_all required");

    const { data: projects, error: pErr } = await query;
    if (pErr) throw pErr;
    if (!projects?.length) throw new Error("no projects");

    const today = new Date().toISOString().slice(0, 10);
    const results: Array<Record<string, unknown>> = [];

    for (const project of projects) {
      try {
        if (!project.metrics_endpoint) {
          results.push({ id: project.id, ok: false, error: "no metrics_endpoint" });
          continue;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (project.metrics_token_secret_name) {
          const token = Deno.env.get(project.metrics_token_secret_name);
          if (token) headers["x-roy-token"] = token;
        }

        const r = await fetch(project.metrics_endpoint, { headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        const m = (await r.json()) as MetricsPayload;

        const mrr = m.mrr_cents ?? 0;
        const { error: upErr } = await supabase
          .from("tech_project_snapshots")
          .upsert(
            {
              project_id: project.id,
              account_id: project.account_id,
              snapshot_date: today,
              mrr_cents: mrr,
              arr_cents: m.arr_cents ?? mrr * 12,
              active_subscriptions: m.active_subscriptions ?? 0,
              new_subscriptions: m.new_subscriptions ?? 0,
              churned_subscriptions: m.churned_subscriptions ?? 0,
              revenue_last_30d_cents: m.revenue_last_30d_cents ?? 0,
              ai_tokens_30d: m.ai_tokens_30d ?? 0,
              ai_cost_cents_30d: m.ai_cost_cents_30d ?? 0,
              currency: (m.currency || project.currency || "BRL").toUpperCase(),
              source: "endpoint",
              raw: { fetched_at: new Date().toISOString(), payload: m },
            },
            { onConflict: "project_id,snapshot_date,source" },
          );
        if (upErr) throw upErr;
        results.push({ id: project.id, name: project.name, ok: true, ...m });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("project ERROR", { id: project.id, msg });
        results.push({ id: project.id, ok: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
