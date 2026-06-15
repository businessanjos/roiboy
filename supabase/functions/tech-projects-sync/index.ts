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
  active_subscribers?: number;
  new_subscriptions?: number;
  new_subscribers_30d?: number;
  churned_subscriptions?: number;
  churned_subscribers_30d?: number;
  revenue_last_30d_cents?: number;
  revenue_30d_cents?: number;
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
    const validate_only: boolean = !!body.validate_only;

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

        // 1) Token criptografado no DB (preferencial)
        const { data: tokenData } = await supabase.rpc(
          "tech_projects_get_token_internal",
          { _project_id: project.id },
        );
        let token: string | null = (tokenData as string | null) ?? null;

        // 2) Fallback: secret de ambiente (legado)
        if (!token && project.metrics_token_secret_name) {
          token = Deno.env.get(project.metrics_token_secret_name) ?? null;
        }
        if (token) headers["x-roy-token"] = token;

        const r = await fetch(project.metrics_endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ source: "roy", project_id: project.id, validate_only }),
        });
        if (!r.ok) {
          const text = await r.text();
          if (validate_only) {
            results.push({
              id: project.id,
              name: project.name,
              ok: false,
              status: r.status,
              error:
                r.status === 401 || r.status === 403
                  ? "Token inválido (ROY_METRICS_TOKEN diferente no projeto)"
                  : `HTTP ${r.status}: ${text.slice(0, 200)}`,
            });
            continue;
          }
          throw new Error(`HTTP ${r.status}: ${text}`);
        }
        const m = (await r.json()) as MetricsPayload;

        if (validate_only) {
          results.push({
            id: project.id,
            name: project.name,
            ok: true,
            status: 200,
            message: "Token válido e endpoint respondeu",
          });
          continue;
        }

        const activeSubscriptions = m.active_subscriptions ?? m.active_subscribers ?? 0;
        const newSubscriptions = m.new_subscriptions ?? m.new_subscribers_30d ?? 0;
        const churnedSubscriptions = m.churned_subscriptions ?? m.churned_subscribers_30d ?? 0;
        const revenueLast30d = m.revenue_last_30d_cents ?? m.revenue_30d_cents ?? 0;
        // Fallback: se o endpoint não calcular MRR mas houver receita 30d, usar receita como proxy de MRR
        const reportedMrr = m.mrr_cents ?? 0;
        const mrr = reportedMrr > 0 ? reportedMrr : revenueLast30d;
        const reportedArr = m.arr_cents ?? 0;
        const arr = reportedArr > 0 ? reportedArr : mrr * 12;
        const { error: upErr } = await supabase
          .from("tech_project_snapshots")
          .upsert(
            {
              project_id: project.id,
              account_id: project.account_id,
              snapshot_date: today,
              mrr_cents: mrr,
              arr_cents: arr,
              active_subscriptions: activeSubscriptions,
              new_subscriptions: newSubscriptions,
              churned_subscriptions: churnedSubscriptions,
              revenue_last_30d_cents: revenueLast30d,
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
