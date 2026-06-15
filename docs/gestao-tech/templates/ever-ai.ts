// Edge function: roy-metrics (Ever AI)
// Cole em: supabase/functions/roy-metrics/index.ts
// Requer secret: ROY_METRICS_TOKEN

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-roy-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("ROY_METRICS_TOKEN");
  const provided = req.headers.get("x-roy-token");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Subscriptions (Stripe-mirrored)
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, amount_cents, created_at, canceled_at");

  let active = 0, mrr_cents = 0, new_subs = 0, churned = 0, revenue_last_30d_cents = 0;
  for (const s of subs ?? []) {
    if (s.status === "active" || s.status === "trialing") {
      active++;
      mrr_cents += s.amount_cents ?? 0;
    }
    if (s.created_at && s.created_at >= since) new_subs++;
    if (s.canceled_at && s.canceled_at >= since) churned++;
  }

  // Revenue 30d — adapte ao seu schema (invoices, payments, etc.)
  const { data: payments } = await supabase
    .from("payments")
    .select("amount_cents, status, paid_at")
    .gte("paid_at", since)
    .eq("status", "paid");
  for (const p of payments ?? []) revenue_last_30d_cents += p.amount_cents ?? 0;

  // AI usage 30d
  const { data: aiUsage } = await supabase.rpc("get_platform_ai_usage", {
    p_start: since,
    p_end: new Date().toISOString(),
  });
  const ai_tokens_30d = aiUsage?.total_tokens ?? 0;
  const ai_cost_cents_30d = Math.round((aiUsage?.total_cost_usd ?? 0) * 500); // USD→BRL approx

  return new Response(JSON.stringify({
    mrr_cents,
    arr_cents: mrr_cents * 12,
    active_subscriptions: active,
    new_subscriptions: new_subs,
    churned_subscriptions: churned,
    revenue_last_30d_cents,
    ai_tokens_30d,
    ai_cost_cents_30d,
    currency: "BRL",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
