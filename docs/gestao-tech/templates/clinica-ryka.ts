// Edge function: roy-metrics (NEW CLINICA RYKA)
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
  if (!expected || req.headers.get("x-roy-token") !== expected) {
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

  // Subscription cache (Stripe-mirrored por clínica/módulo)
  const { data: cache } = await supabase
    .from("clinic_subscription_cache")
    .select("status, amount, module_key, current_period_end, checked_at");

  let active = 0, mrr_cents = 0;
  for (const c of cache ?? []) {
    if (c.status === "active" || c.status === "trialing") {
      active++;
      mrr_cents += Math.round(Number(c.amount ?? 0) * 100);
    }
  }

  // Novas clínicas (proxy para new_subscriptions)
  const { count: new_clinics } = await supabase
    .from("clinics")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  // Clinicas churnadas no período
  const { count: churned } = await supabase
    .from("clinics")
    .select("id", { count: "exact", head: true })
    .eq("is_active", false)
    .gte("updated_at", since);

  return new Response(JSON.stringify({
    mrr_cents,
    arr_cents: mrr_cents * 12,
    active_subscriptions: active,
    new_subscriptions: new_clinics ?? 0,
    churned_subscriptions: churned ?? 0,
    revenue_last_30d_cents: mrr_cents, // proxy: snapshot mensal recorrente
    ai_tokens_30d: 0, // Clinica Ryka não loga tokens hoje
    ai_cost_cents_30d: 0,
    currency: "BRL",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
