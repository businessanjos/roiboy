import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META = "https://graph.facebook.com/v21.0";

async function getToken(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { error: "Não autenticado", status: 401 } as const;
  const supaAuth = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await supaAuth.auth.getUser();
  if (!user) return { error: "Não autorizado", status: 401 } as const;
  const supabase = createClient(supabaseUrl, svc);
  const { data: tk } = await supabase.from("user_meta_tokens").select("access_token, expires_at").eq("user_id", user.id).maybeSingle();
  if (!tk) return { error: "Meta não conectado", status: 400 } as const;
  if (tk.expires_at && new Date(tk.expires_at) < new Date()) return { error: "Token expirado", status: 401 } as const;
  return { token: tk.access_token, user, supabase } as const;
}

function parseInsights(ins: any) {
  if (!ins) return null;
  const i = ins.data?.[0] || ins;
  if (!i || Object.keys(i).length === 0) return null;
  let conversions = 0, leads = 0, purchases = 0, purchaseValue = 0;
  for (const a of (i.actions || [])) {
    if (["lead", "complete_registration"].includes(a.action_type)) leads += parseInt(a.value) || 0;
    if (["purchase", "omni_purchase"].includes(a.action_type)) purchases += parseInt(a.value) || 0;
    if (["lead", "complete_registration", "purchase", "omni_purchase"].includes(a.action_type)) conversions += parseInt(a.value) || 0;
  }
  for (const a of (i.action_values || [])) {
    if (["purchase", "omni_purchase"].includes(a.action_type)) purchaseValue += parseFloat(a.value) || 0;
  }
  const spend = parseFloat(i.spend) || 0;
  return {
    spend,
    impressions: parseInt(i.impressions) || 0,
    clicks: parseInt(i.clicks) || 0,
    reach: parseInt(i.reach) || 0,
    ctr: parseFloat(i.ctr) || 0,
    cpc: parseFloat(i.cpc) || 0,
    cpm: parseFloat(i.cpm) || 0,
    frequency: parseFloat(i.frequency) || 0,
    leads,
    purchases,
    purchaseValue,
    conversions,
    cpl: leads > 0 ? +(spend / leads).toFixed(2) : 0,
    cpa: conversions > 0 ? +(spend / conversions).toFixed(2) : 0,
    roas: spend > 0 ? +(purchaseValue / spend).toFixed(2) : 0,
  };
}

const STATUS_MAP: Record<string, string> = { ACTIVE: "active", PAUSED: "paused", DELETED: "deleted", ARCHIVED: "archived" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await getToken(req);
    if ("error" in auth) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { token } = auth;
    const body = await req.json();
    const { action } = body;

    // ============ LIST CAMPAIGNS ============
    if (action === "list_campaigns") {
      const { adAccountId, datePreset = "last_30d" } = body;
      if (!adAccountId) return new Response(JSON.stringify({ error: "adAccountId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const acc = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
      const fields = `id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,buying_type,special_ad_categories,insights.date_preset(${datePreset}){impressions,clicks,spend,reach,actions,action_values,ctr,cpc,cpm,frequency}`;
      const url = `${META}/${acc}/campaigns?fields=${fields}&limit=100&access_token=${token}`;
      const r = await (await fetch(url)).json();
      if (r.error) return new Response(JSON.stringify({ error: r.error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const campaigns = (r.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        status: STATUS_MAP[c.effective_status] || c.effective_status?.toLowerCase() || "paused",
        configured_status: c.status,
        objective: c.objective,
        daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
        start_time: c.start_time,
        stop_time: c.stop_time,
        created_time: c.created_time,
        buying_type: c.buying_type,
        insights: parseInsights(c.insights),
      }));
      return new Response(JSON.stringify({ success: true, campaigns }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ LIST ADSETS ============
    if (action === "list_adsets") {
      const { campaignId, datePreset = "last_30d" } = body;
      if (!campaignId) return new Response(JSON.stringify({ error: "campaignId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const fields = `id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting,start_time,end_time,insights.date_preset(${datePreset}){impressions,clicks,spend,reach,actions,action_values,ctr,cpc,cpm,frequency}`;
      const url = `${META}/${campaignId}/adsets?fields=${fields}&limit=100&access_token=${token}`;
      const r = await (await fetch(url)).json();
      if (r.error) return new Response(JSON.stringify({ error: r.error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const adsets = (r.data || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        status: STATUS_MAP[a.effective_status] || a.effective_status?.toLowerCase() || "paused",
        configured_status: a.status,
        daily_budget: a.daily_budget ? parseFloat(a.daily_budget) / 100 : null,
        lifetime_budget: a.lifetime_budget ? parseFloat(a.lifetime_budget) / 100 : null,
        optimization_goal: a.optimization_goal,
        billing_event: a.billing_event,
        start_time: a.start_time,
        end_time: a.end_time,
        insights: parseInsights(a.insights),
      }));
      return new Response(JSON.stringify({ success: true, adsets }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ LIST ADS WITH CREATIVES ============
    if (action === "list_ads") {
      const { adsetId, datePreset = "last_30d" } = body;
      if (!adsetId) return new Response(JSON.stringify({ error: "adsetId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const fields = `id,name,status,effective_status,creative{id,name,title,body,thumbnail_url,image_url,object_story_spec,asset_feed_spec,effective_object_story_id},preview_shareable_link,insights.date_preset(${datePreset}){impressions,clicks,spend,reach,actions,action_values,ctr,cpc,cpm,frequency}`;
      const url = `${META}/${adsetId}/ads?fields=${fields}&limit=50&access_token=${token}`;
      const r = await (await fetch(url)).json();
      if (r.error) return new Response(JSON.stringify({ error: r.error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const ads = (r.data || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        status: STATUS_MAP[a.effective_status] || a.effective_status?.toLowerCase() || "paused",
        configured_status: a.status,
        preview_url: a.preview_shareable_link,
        creative: a.creative ? {
          id: a.creative.id,
          name: a.creative.name,
          title: a.creative.title || a.creative.object_story_spec?.link_data?.name || a.creative.object_story_spec?.video_data?.title,
          body: a.creative.body || a.creative.object_story_spec?.link_data?.message || a.creative.object_story_spec?.video_data?.message,
          thumbnail_url: a.creative.thumbnail_url || a.creative.image_url,
          image_url: a.creative.image_url,
        } : null,
        insights: parseInsights(a.insights),
      }));
      return new Response(JSON.stringify({ success: true, ads }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ TOGGLE STATUS (ACTIVE/PAUSED) ============
    if (action === "toggle_status") {
      const { entityType, entityId, status } = body;
      if (!entityId || !["ACTIVE", "PAUSED"].includes(status)) {
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const url = `${META}/${entityId}`;
      const fd = new FormData();
      fd.append("status", status);
      fd.append("access_token", token);
      const r = await (await fetch(url, { method: "POST", body: fd })).json();
      if (r.error) return new Response(JSON.stringify({ error: r.error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, entityType }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ UPDATE BUDGET ============
    if (action === "update_budget") {
      const { entityId, dailyBudget, lifetimeBudget } = body;
      if (!entityId) return new Response(JSON.stringify({ error: "entityId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const url = `${META}/${entityId}`;
      const fd = new FormData();
      if (dailyBudget != null) fd.append("daily_budget", String(Math.round(dailyBudget * 100)));
      if (lifetimeBudget != null) fd.append("lifetime_budget", String(Math.round(lifetimeBudget * 100)));
      fd.append("access_token", token);
      const r = await (await fetch(url, { method: "POST", body: fd })).json();
      if (r.error) return new Response(JSON.stringify({ error: r.error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ TIMESERIES (BI) ============
    if (action === "timeseries") {
      const { adAccountId, datePreset = "last_30d" } = body;
      if (!adAccountId) return new Response(JSON.stringify({ error: "adAccountId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const acc = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
      const fields = "spend,impressions,clicks,reach,actions,ctr,cpc,cpm";
      const url = `${META}/${acc}/insights?fields=${fields}&date_preset=${datePreset}&time_increment=1&limit=200&access_token=${token}`;
      const r = await (await fetch(url)).json();
      if (r.error) return new Response(JSON.stringify({ error: r.error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const series = (r.data || []).map((d: any) => {
        let leads = 0;
        for (const a of (d.actions || [])) {
          if (["lead", "complete_registration"].includes(a.action_type)) leads += parseInt(a.value) || 0;
        }
        return {
          date: d.date_start,
          spend: parseFloat(d.spend) || 0,
          impressions: parseInt(d.impressions) || 0,
          clicks: parseInt(d.clicks) || 0,
          reach: parseInt(d.reach) || 0,
          ctr: parseFloat(d.ctr) || 0,
          cpc: parseFloat(d.cpc) || 0,
          cpm: parseFloat(d.cpm) || 0,
          leads,
        };
      });
      return new Response(JSON.stringify({ success: true, series }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("meta-campaigns-manager error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
