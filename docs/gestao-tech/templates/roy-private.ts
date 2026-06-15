// Edge function: roy-metrics (ROY PRIVATE)
// ROY PRIVATE não tem billing próprio — retorna apenas uso (zero para faturamento).
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

  // Proxy "active": usuários ativos
  const { count: active } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  return new Response(JSON.stringify({
    mrr_cents: 0,
    arr_cents: 0,
    active_subscriptions: active ?? 0,
    new_subscriptions: 0,
    churned_subscriptions: 0,
    revenue_last_30d_cents: 0,
    ai_tokens_30d: 0,
    ai_cost_cents_30d: 0,
    currency: "BRL",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
