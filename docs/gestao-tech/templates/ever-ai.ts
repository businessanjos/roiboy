// Edge function: roy-metrics (Ever AI) — v2 com MRR real, faturamento mês fechado e mensagens IA
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

  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // mês ATUAL (1º dia 00:00 UTC)
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  // mês FECHADO anterior
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
  const lastMonthEnd = currentMonthStart;
  const lastMonthLabel = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // === Assinaturas (espelho do Stripe na tabela `subscriptions`)
  // Ajuste os nomes de tabela/colunas se diferentes no seu schema.
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("status, amount_cents, created_at, canceled_at, current_period_end");

  let active = 0, trialing = 0, past_due = 0;
  let mrr_cents = 0;
  let new_subs = 0, churned = 0;

  for (const s of subs ?? []) {
    if (s.status === "active") { active++; mrr_cents += s.amount_cents ?? 0; }
    else if (s.status === "trialing") { trialing++; }
    else if (s.status === "past_due") { past_due++; mrr_cents += s.amount_cents ?? 0; }
    if (s.created_at && s.created_at >= since30d) new_subs++;
    if (s.canceled_at && s.canceled_at >= since30d) churned++;
  }

  // === Faturamento últimos 30d (rolling)
  const { data: pay30 } = await supabase
    .from("payments")
    .select("amount_cents, status, paid_at")
    .eq("status", "paid")
    .gte("paid_at", since30d);
  const revenue_last_30d_cents = (pay30 ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  // === Faturamento MÊS FECHADO (mês passado)
  const { data: payLastMonth } = await supabase
    .from("payments")
    .select("amount_cents, status, paid_at")
    .eq("status", "paid")
    .gte("paid_at", lastMonthStart)
    .lt("paid_at", lastMonthEnd);
  const revenue_last_month_cents = (payLastMonth ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  // === Faturamento MÊS ATUAL (parcial, do dia 1 até agora)
  const { data: payCurrent } = await supabase
    .from("payments")
    .select("amount_cents, status, paid_at")
    .eq("status", "paid")
    .gte("paid_at", currentMonthStart);
  const revenue_current_month_cents = (payCurrent ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  // === Uso de IA (mensagens + custo)
  // Ajuste para sua tabela real. Se tiver RPC `get_platform_ai_usage`, use-a.
  let ai_tokens_30d = 0, ai_cost_cents_30d = 0, ai_messages_30d = 0;
  try {
    const { data: aiRpc } = await supabase.rpc("get_platform_ai_usage", {
      p_start: since30d, p_end: now.toISOString(),
    });
    ai_tokens_30d = aiRpc?.total_tokens ?? 0;
    ai_cost_cents_30d = Math.round((aiRpc?.total_cost_usd ?? 0) * 500); // USD→BRL aprox
    ai_messages_30d = aiRpc?.total_messages ?? 0;
  } catch (_e) {
    // fallback: contar diretamente tabela ai_usage_logs
    const { count: msgCount } = await supabase
      .from("ai_usage_logs").select("id", { count: "exact", head: true })
      .gte("created_at", since30d);
    ai_messages_30d = msgCount ?? 0;
  }

  return new Response(JSON.stringify({
    mrr_cents,
    arr_cents: mrr_cents * 12,
    active_subscriptions: active,
    trialing_subscriptions: trialing,
    past_due_subscriptions: past_due,
    new_subscriptions: new_subs,
    churned_subscriptions: churned,
    net_new_subscriptions: new_subs - churned,
    revenue_last_30d_cents,
    revenue_last_month_cents,
    revenue_current_month_cents,
    last_month_label: lastMonthLabel,
    ai_tokens_30d,
    ai_messages_30d,
    ai_cost_cents_30d,
    currency: "BRL",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
