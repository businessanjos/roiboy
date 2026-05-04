import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tokenData } = await supabase.from('user_meta_tokens').select('access_token, expires_at').eq('user_id', user.id).maybeSingle();
    if (!tokenData) return new Response(JSON.stringify({ error: 'Meta não conectado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Token expirado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { adAccountId, datePreset = 'last_30d' } = await req.json();
    if (!adAccountId) return new Response(JSON.stringify({ error: 'adAccountId obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `https://graph.facebook.com/v21.0/${accountId}/campaigns?fields=id,name,status,effective_status,objective,insights.date_preset(${datePreset}){impressions,clicks,spend,actions,ctr,cpc,cpm}&limit=50&access_token=${tokenData.access_token}`;
    const res = await (await fetch(url)).json();
    if (res.error) return new Response(JSON.stringify({ error: res.error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const campaigns = res.data || [];
    const statusMap: Record<string, string> = { ACTIVE: 'active', PAUSED: 'paused', DELETED: 'deleted', ARCHIVED: 'archived' };
    const rows = campaigns.map((c: any) => {
      const ins = c.insights?.data?.[0] || {};
      let conversions = 0;
      for (const a of (ins.actions || [])) {
        if (['purchase','omni_purchase','lead','complete_registration'].includes(a.action_type)) conversions += parseInt(a.value) || 0;
      }
      const spend = parseFloat(ins.spend) || 0;
      return {
        user_id: user.id, meta_campaign_id: c.id, name: c.name, platform: 'Meta Ads',
        status: statusMap[c.effective_status] || 'paused',
        spend, impressions: parseInt(ins.impressions) || 0, clicks: parseInt(ins.clicks) || 0,
        conversions, cpl: conversions > 0 ? +(spend / conversions).toFixed(2) : 0,
        updated_at: new Date().toISOString(),
      };
    });

    await supabase.from('marketing_ad_sets').delete().eq('user_id', user.id);
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('marketing_ad_sets').insert(rows as any);
      if (insErr) return new Response(JSON.stringify({ error: 'Erro ao salvar' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, count: rows.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('sync-meta-campaigns error:', e);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
