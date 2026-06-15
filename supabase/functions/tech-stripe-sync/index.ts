import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[tech-stripe-sync] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id } = await req.json().catch(() => ({}));
    if (!project_id) throw new Error("project_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("missing auth");
    const { data: userData } = await supabase.auth.getUser(
      auth.replace("Bearer ", ""),
    );
    if (!userData?.user) throw new Error("invalid user");

    const { data: project, error: pErr } = await supabase
      .from("tech_projects")
      .select("*")
      .eq("id", project_id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!project) throw new Error("project not found");

    const secretName = project.stripe_secret_name || "STRIPE_SECRET_KEY";
    const stripeKey = Deno.env.get(secretName);
    if (!stripeKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Secret '${secretName}' não encontrado. Cadastre a chave Stripe deste projeto.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Active subscriptions + MRR
    let mrrCents = 0;
    let active = 0;
    let startingAfter: string | undefined;
    do {
      const page = await stripe.subscriptions.list({
        status: "active",
        limit: 100,
        starting_after: startingAfter,
      });
      for (const sub of page.data) {
        active++;
        for (const item of sub.items.data) {
          const amount = item.price.unit_amount ?? 0;
          const qty = item.quantity ?? 1;
          const interval = item.price.recurring?.interval;
          const intervalCount = item.price.recurring?.interval_count ?? 1;
          let monthly = amount * qty;
          if (interval === "year") monthly = monthly / (12 * intervalCount);
          else if (interval === "week") monthly = (monthly * 52) / (12 * intervalCount);
          else if (interval === "day") monthly = (monthly * 30) / intervalCount;
          else monthly = monthly / intervalCount;
          mrrCents += Math.round(monthly);
        }
      }
      startingAfter = page.has_more ? page.data[page.data.length - 1].id : undefined;
    } while (startingAfter);

    // Revenue last 30d (paid invoices)
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    let revenueCents = 0;
    let newSubs = 0;
    let churned = 0;

    const invoices = await stripe.invoices.list({
      limit: 100,
      created: { gte: since },
      status: "paid",
    });
    for (const inv of invoices.data) revenueCents += inv.amount_paid ?? 0;

    const recentSubs = await stripe.subscriptions.list({
      limit: 100,
      created: { gte: since },
    });
    newSubs = recentSubs.data.length;

    const canceled = await stripe.subscriptions.list({
      status: "canceled",
      limit: 100,
    });
    churned = canceled.data.filter((s) => (s.canceled_at ?? 0) >= since).length;

    const today = new Date().toISOString().slice(0, 10);

    const { error: upErr } = await supabase
      .from("tech_project_snapshots")
      .upsert(
        {
          project_id: project.id,
          account_id: project.account_id,
          snapshot_date: today,
          mrr_cents: mrrCents,
          arr_cents: mrrCents * 12,
          active_subscriptions: active,
          new_subscriptions: newSubs,
          churned_subscriptions: churned,
          revenue_last_30d_cents: revenueCents,
          currency: (invoices.data[0]?.currency || "brl").toUpperCase(),
          source: "stripe",
          raw: { fetched_at: new Date().toISOString() },
        },
        { onConflict: "project_id,snapshot_date,source" },
      );
    if (upErr) throw upErr;

    log("done", { project_id, mrrCents, active });
    return new Response(
      JSON.stringify({
        ok: true,
        snapshot: {
          mrr_cents: mrrCents,
          active_subscriptions: active,
          new_subscriptions: newSubs,
          churned_subscriptions: churned,
          revenue_last_30d_cents: revenueCents,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
