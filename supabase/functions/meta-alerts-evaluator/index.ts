import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META = "https://graph.facebook.com/v21.0";

function parseInsights(i: any) {
  if (!i) return null;
  let leads = 0, purchases = 0, purchaseValue = 0;
  for (const a of (i.actions || [])) {
    if (["lead", "complete_registration"].includes(a.action_type)) leads += parseInt(a.value) || 0;
    if (["purchase", "omni_purchase"].includes(a.action_type)) purchases += parseInt(a.value) || 0;
  }
  for (const a of (i.action_values || [])) {
    if (["purchase", "omni_purchase"].includes(a.action_type)) purchaseValue += parseFloat(a.value) || 0;
  }
  const spend = parseFloat(i.spend) || 0;
  return {
    spend,
    ctr: parseFloat(i.ctr) || 0,
    frequency: parseFloat(i.frequency) || 0,
    leads,
    cpl: leads > 0 ? +(spend / leads).toFixed(2) : 0,
    roas: spend > 0 ? +(purchaseValue / spend).toFixed(2) : 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, svc);

    const { data: alerts } = await supabase
      .from("meta_campaign_alerts")
      .select("*")
      .eq("enabled", true);
    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ success: true, evaluated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let triggered = 0;
    // Group by created_by to fetch token once per user
    const tokenCache: Record<string, string> = {};
    async function getToken(userId: string) {
      if (tokenCache[userId]) return tokenCache[userId];
      const { data: tk } = await supabase.from("user_meta_tokens").select("access_token, expires_at").eq("user_id", userId).maybeSingle();
      if (!tk) return null;
      if (tk.expires_at && new Date(tk.expires_at) < new Date()) return null;
      tokenCache[userId] = tk.access_token;
      return tk.access_token;
    }

    for (const al of alerts) {
      const token = al.created_by ? await getToken(al.created_by) : null;
      if (!token) continue;

      const url = `${META}/${al.campaign_id}/insights?fields=spend,impressions,clicks,actions,action_values,ctr,frequency&date_preset=${al.date_preset || "last_3d"}&access_token=${token}`;
      const r = await (await fetch(url)).json();
      if (r.error) { console.error("alert fetch error", al.id, r.error?.message); continue; }
      const ins = parseInsights(r.data?.[0]);
      if (!ins) continue;

      const breaches: { metric: string; threshold: number; observed: number; msg: string }[] = [];
      if (al.cpl_max != null && ins.cpl > 0 && ins.cpl > Number(al.cpl_max)) {
        breaches.push({ metric: "cpl", threshold: Number(al.cpl_max), observed: ins.cpl, msg: `CPL R$ ${ins.cpl.toFixed(2)} acima do limite R$ ${Number(al.cpl_max).toFixed(2)}` });
      }
      if (al.roas_min != null && ins.roas > 0 && ins.roas < Number(al.roas_min)) {
        breaches.push({ metric: "roas", threshold: Number(al.roas_min), observed: ins.roas, msg: `ROAS ${ins.roas.toFixed(2)} abaixo do mínimo ${Number(al.roas_min).toFixed(2)}` });
      }
      if (al.ctr_min != null && ins.ctr > 0 && ins.ctr < Number(al.ctr_min)) {
        breaches.push({ metric: "ctr", threshold: Number(al.ctr_min), observed: ins.ctr, msg: `CTR ${ins.ctr.toFixed(2)}% abaixo do mínimo ${Number(al.ctr_min).toFixed(2)}%` });
      }
      if (al.frequency_max != null && ins.frequency > Number(al.frequency_max)) {
        breaches.push({ metric: "frequency", threshold: Number(al.frequency_max), observed: ins.frequency, msg: `Frequência ${ins.frequency.toFixed(2)} acima do limite ${Number(al.frequency_max).toFixed(2)}` });
      }
      if (al.spend_daily_max != null && ins.spend > Number(al.spend_daily_max)) {
        breaches.push({ metric: "spend", threshold: Number(al.spend_daily_max), observed: ins.spend, msg: `Gasto R$ ${ins.spend.toFixed(2)} acima do limite R$ ${Number(al.spend_daily_max).toFixed(2)}` });
      }
      if (breaches.length === 0) continue;

      // Cooldown check
      const cooldownMs = (al.cooldown_hours || 6) * 3600 * 1000;
      const since = new Date(Date.now() - cooldownMs).toISOString();
      const { data: recent } = await supabase
        .from("meta_campaign_alert_events")
        .select("metric")
        .eq("alert_id", al.id)
        .gte("created_at", since);
      const recentMetrics = new Set((recent || []).map(e => e.metric));

      for (const b of breaches) {
        if (recentMetrics.has(b.metric)) continue;
        await supabase.from("meta_campaign_alert_events").insert({
          alert_id: al.id, account_id: al.account_id, campaign_id: al.campaign_id,
          metric: b.metric, threshold: b.threshold, observed_value: b.observed, message: b.msg,
        });
        // Resolve target users -> internal users.id rows
        const targetAuthIds: string[] = (al.notify_user_ids && al.notify_user_ids.length > 0) ? al.notify_user_ids : (al.created_by ? [al.created_by] : []);
        if (targetAuthIds.length === 0) continue;
        const { data: targetUsers } = await supabase.from("users").select("id, account_id").in("auth_user_id", targetAuthIds);
        const notif = (targetUsers || []).map(u => ({
          account_id: u.account_id,
          user_id: u.id,
          type: "meta_alert",
          title: `Alerta Meta Ads: ${al.campaign_name || "Campanha"}`,
          content: b.msg,
          link: "/marketing/trafego-pago",
          source_type: "meta_campaign_alert",
        }));
        if (notif.length > 0) await supabase.from("notifications").insert(notif);
        triggered++;
      }
    }

    return new Response(JSON.stringify({ success: true, triggered }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("meta-alerts-evaluator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
