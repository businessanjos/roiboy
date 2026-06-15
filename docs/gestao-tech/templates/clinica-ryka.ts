// Edge function: roy-metrics (NEW CLINICA RYKA) — v2 com churn REAL via subscriptions
// Cole em: supabase/functions/roy-metrics/index.ts
// Requer secret: ROY_METRICS_TOKEN
//
// FIX importante (v2): a v1 contava como "churn" qualquer clínica com
// is_active=false E updated_at nos últimos 30d → incluía limpeza de seed,
// reativações, edição administrativa, gerando números absurdos (281+).
// Agora churn é calculado a partir de `clinic_subscription_cache.status='canceled'`
// dentro da janela, que é o único sinal financeiro confiável.

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
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
  const lastMonthEnd = currentMonthStart;
  const lastMonthLabel = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // === Subscription cache (Stripe mirror por clínica/módulo)
  const { data: cache } = await supabase
    .from("clinic_subscription_cache")
    .select("status, amount, current_period_end, canceled_at, created_at, updated_at");

  let active = 0, trialing = 0, past_due = 0;
  let mrr_cents = 0;
  let new_subs = 0, churned = 0;

  for (const c of cache ?? []) {
    const amount_cents = Math.round(Number(c.amount ?? 0) * 100);
    if (c.status === "active") { active++; mrr_cents += amount_cents; }
    else if (c.status === "trialing") { trialing++; }
    else if (c.status === "past_due") { past_due++; mrr_cents += amount_cents; }

    if (c.created_at && c.created_at >= since30d) new_subs++;
    // Churn REAL: só conta se status virou canceled E canceled_at está na janela
    if (c.status === "canceled" && c.canceled_at && c.canceled_at >= since30d) {
      churned++;
    }
  }

  // === Faturamento — usa tabela de pagamentos/invoices da Ryka
  // Se vocês têm tabela `clinic_invoices` ou `payments`, ajuste aqui.
  let revenue_last_30d_cents = 0;
  let revenue_last_month_cents = 0;
  let revenue_current_month_cents = 0;
  try {
    const { data: pay30 } = await supabase
      .from("clinic_invoices").select("amount_cents, status, paid_at")
      .eq("status", "paid").gte("paid_at", since30d);
    revenue_last_30d_cents = (pay30 ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

    const { data: payLM } = await supabase
      .from("clinic_invoices").select("amount_cents, status, paid_at")
      .eq("status", "paid").gte("paid_at", lastMonthStart).lt("paid_at", lastMonthEnd);
    revenue_last_month_cents = (payLM ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

    const { data: payCM } = await supabase
      .from("clinic_invoices").select("amount_cents, status, paid_at")
      .eq("status", "paid").gte("paid_at", currentMonthStart);
    revenue_current_month_cents = (payCM ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  } catch (_e) {
    // fallback: assume recorrência mensal igual ao MRR
    revenue_last_30d_cents = mrr_cents;
    revenue_last_month_cents = mrr_cents;
    revenue_current_month_cents = Math.round(mrr_cents * (now.getUTCDate() / 30));
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
    ai_tokens_30d: 0,
    ai_messages_30d: 0,
    ai_cost_cents_30d: 0,
    currency: "BRL",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
