import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ??
      (req.method === "POST" ? (await req.json().catch(() => ({}))).token : null);

    if (!token || typeof token !== "string" || token.length < 8) {
      return json(400, { error: "invalid_token" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkErr } = await admin
      .from("incentive_plan_share_links")
      .select("id, account_id, plan_id, is_active, expires_at, label")
      .eq("token", token)
      .maybeSingle();

    if (linkErr) return json(500, { error: "lookup_failed" });
    if (!link) return json(404, { error: "not_found" });
    if (!link.is_active) return json(410, { error: "revoked" });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return json(410, { error: "expired" });
    }

    // Resolve sales-department plan (or pinned plan)
    let planQuery = admin
      .from("sales_incentive_plans")
      .select("*")
      .eq("account_id", link.account_id);

    if (link.plan_id) planQuery = planQuery.eq("id", link.plan_id);
    else planQuery = planQuery.eq("is_active", true);

    const { data: plans, error: plansErr } = await planQuery;
    if (plansErr) return json(500, { error: "plans_failed" });

    let plan: any = null;
    if (link.plan_id) {
      plan = plans?.[0] ?? null;
    } else {
      // pick plan whose position belongs to a comercial/vendas dept
      const { data: depts } = await admin
        .from("hr_departments")
        .select("id, name")
        .eq("account_id", link.account_id);
      const salesDeptIds = (depts ?? [])
        .filter((d: any) => /comercial|vendas|sales/i.test(d.name))
        .map((d: any) => d.id);
      let salesPosIds: string[] = [];
      if (salesDeptIds.length) {
        const { data: pos } = await admin
          .from("hr_positions")
          .select("id")
          .in("department_id", salesDeptIds);
        salesPosIds = (pos ?? []).map((p: any) => p.id);
      }
      plan =
        (plans ?? []).find(
          (p: any) => p.position_id && salesPosIds.includes(p.position_id),
        ) ?? (plans ?? [])[0] ?? null;
    }

    if (!plan) return json(404, { error: "no_plan" });

    const { data: tiers } = await admin
      .from("sales_incentive_tiers")
      .select("*")
      .eq("plan_id", plan.id);

    // fire-and-forget telemetry
    admin
      .from("incentive_plan_share_links")
      .update({
        view_count: undefined, // computed below
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", link.id)
      .then(() => {});

    // Increment view_count atomically via raw rpc-less update
    admin
      .rpc("noop_does_not_exist", {})
      .then(() => {}, () => {});
    await admin
      .from("incentive_plan_share_links")
      .update({ last_viewed_at: new Date().toISOString() })
      .eq("id", link.id);
    // Best-effort increment: select then update
    const { data: cur } = await admin
      .from("incentive_plan_share_links")
      .select("view_count")
      .eq("id", link.id)
      .maybeSingle();
    if (cur) {
      await admin
        .from("incentive_plan_share_links")
        .update({ view_count: (cur.view_count ?? 0) + 1 })
        .eq("id", link.id);
    }

    return json(200, {
      label: link.label,
      plan,
      tiers: tiers ?? [],
    });
  } catch (e) {
    console.error("public-incentive-plan error", e);
    return json(500, { error: "internal_error" });
  }
});
