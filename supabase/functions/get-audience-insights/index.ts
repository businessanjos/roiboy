import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tokenData } = await supabase.from('user_meta_tokens').select('access_token, expires_at').eq('user_id', user.id).maybeSingle();
    if (!tokenData) return new Response(JSON.stringify({ error: 'Meta não conectado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Token expirado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { adAccountId, datePreset = 'last_30d' } = await req.json();
    if (!adAccountId) return new Response(JSON.stringify({ error: 'adAccountId obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const params = new URLSearchParams({
      access_token: tokenData.access_token,
      fields: 'impressions,clicks,spend,actions,ctr,cpc,cpm,cpp,reach,frequency,action_values,video_p100_watched_actions,video_thruplay_watched_actions,inline_post_engagement',
      date_preset: datePreset,
      level: 'account',
    });
    const data = await (await fetch(`https://graph.facebook.com/v21.0/${accountId}/insights?${params}`)).json();
    if (data.error) return new Response(JSON.stringify({ error: data.error.message, code: data.error.code }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const ins = data.data?.[0] || {};
    let conversions = 0, leads = 0, purchases = 0, purchaseValue = 0, landingPageViews = 0;
    for (const a of (ins.actions || [])) {
      const v = parseInt(a.value) || 0;
      if (a.action_type === 'purchase' || a.action_type === 'omni_purchase') { purchases += v; conversions += v; }
      else if (a.action_type === 'lead') { leads += v; conversions += v; }
      else if (a.action_type === 'complete_registration') conversions += v;
      else if (a.action_type === 'landing_page_view') landingPageViews += v;
    }
    for (const av of (ins.action_values || [])) {
      if (av.action_type === 'purchase' || av.action_type === 'omni_purchase') purchaseValue += parseFloat(av.value) || 0;
    }
    let videoViews = 0, videoThruplay = 0;
    for (const v of (ins.video_p100_watched_actions || [])) videoViews += parseInt(v.value) || 0;
    for (const v of (ins.video_thruplay_watched_actions || [])) videoThruplay += parseInt(v.value) || 0;

    const spend = parseFloat(ins.spend) || 0;
    const impressions = parseInt(ins.impressions) || 0;
    const result = {
      impressions,
      clicks: parseInt(ins.clicks) || 0,
      spend,
      conversions,
      reach: parseInt(ins.reach) || 0,
      frequency: parseFloat(ins.frequency) || 0,
      ctr: parseFloat(ins.ctr) || 0,
      cpc: parseFloat(ins.cpc) || 0,
      cpm: parseFloat(ins.cpm) || 0,
      cpp: parseFloat(ins.cpp) || 0,
      engagement_rate: impressions > 0 ? ((parseInt(ins.inline_post_engagement) || 0) / impressions) * 100 : 0,
      post_engagement: parseInt(ins.inline_post_engagement) || 0,
      video_views: videoViews,
      video_thruplay: videoThruplay,
      leads,
      purchases,
      purchase_value: purchaseValue,
      roas: spend > 0 ? purchaseValue / spend : 0,
      landing_page_views: landingPageViews,
      cost_per_result: conversions > 0 ? spend / conversions : 0,
      datePreset,
    };

    return new Response(JSON.stringify({ success: true, insights: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('get-audience-insights error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
