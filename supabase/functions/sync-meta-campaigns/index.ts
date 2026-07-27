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

    const { adAccountId, datePreset = 'last_30d', since, until } = await req.json();
    if (!adAccountId) return new Response(JSON.stringify({ error: 'adAccountId obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const insightsParam = (since && until)
      ? `insights.time_range({'since':'${since}','until':'${until}'})`
      : `insights.date_preset(${datePreset})`;
    let url: string | null = `https://graph.facebook.com/v21.0/${accountId}/campaigns?fields=id,name,status,effective_status,objective,${insightsParam}{impressions,clicks,spend,actions,ctr,cpc,cpm}&limit=200&access_token=${tokenData.access_token}`;
    const campaigns: any[] = [];
    let pages = 0;
    while (url && pages < 20) {
      const res: any = await (await fetch(url)).json();
      if (res.error) return new Response(JSON.stringify({ error: res.error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      campaigns.push(...(res.data || []));
      url = res.paging?.next || null;
      pages++;
    }
    const statusMap: Record<string, string> = { ACTIVE: 'active', PAUSED: 'paused', DELETED: 'deleted', ARCHIVED: 'archived' };
    const rows = campaigns.map((c: any) => {
      const ins = c.insights?.data?.[0] || {};
      let conversions = 0;
      for (const a of (ins.actions || [])) {
        if (['purchase','omni_purchase','lead','complete_registration'].includes(a.action_type)) conversions += parseInt(a.value) || 0;
      }
      const spend = parseFloat(ins.spend) || 0;
      return {
        user_id: user.id, meta_campaign_id: c.id, meta_ad_account_id: accountId,
        name: c.name, platform: 'Meta Ads',
        status: statusMap[c.effective_status] || 'paused',
        spend, impressions: parseInt(ins.impressions) || 0, clicks: parseInt(ins.clicks) || 0,
        conversions, cpl: conversions > 0 ? +(spend / conversions).toFixed(2) : 0,
        updated_at: new Date().toISOString(),
      };
    });

    // Scope delete to THIS account only so multiple accounts can coexist
    await supabase.from('marketing_ad_sets')
      .delete()
      .eq('user_id', user.id)
      .eq('meta_ad_account_id', accountId);
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('marketing_ad_sets').insert(rows as any);
      if (insErr) return new Response(JSON.stringify({ error: 'Erro ao salvar' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== SNAPSHOTS DIÁRIOS (time_increment=1) =====
    // Guarda a série diária de gasto/leads para que ROAS e CPL por período
    // reflitam o que realmente aconteceu, e não o acumulado do último sync.
    let dailyRows = 0;
    try {
      const dayMs = 86400000;
      const toIso = (d: Date) => d.toISOString().split('T')[0];
      const dSince = since || toIso(new Date(Date.now() - 90 * dayMs));
      const dUntil = until || toIso(new Date());

      // Herda account_id / agency_id já resolvidos nos ad sets desse usuário
      const { data: scope } = await supabase
        .from('marketing_ad_sets')
        .select('account_id, agency_id')
        .eq('user_id', user.id)
        .eq('meta_ad_account_id', accountId)
        .limit(1)
        .maybeSingle();

      const nameById = new Map<string, string>(campaigns.map((c: any) => [c.id, c.name]));
      const daily: any[] = [];
      let dUrl: string | null = `https://graph.facebook.com/v21.0/${accountId}/insights?level=campaign&time_increment=1&time_range={'since':'${dSince}','until':'${dUntil}'}&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&limit=500&access_token=${tokenData.access_token}`;
      let dPages = 0;
      while (dUrl && dPages < 40) {
        const res: any = await (await fetch(dUrl)).json();
        if (res.error) { console.error('daily insights error:', res.error.message); break; }
        for (const r of (res.data || [])) {
          let conv = 0;
          for (const a of (r.actions || [])) {
            if (['purchase', 'omni_purchase', 'lead', 'complete_registration'].includes(a.action_type)) conv += parseInt(a.value) || 0;
          }
          daily.push({
            user_id: user.id,
            account_id: scope?.account_id ?? null,
            agency_id: scope?.agency_id ?? null,
            meta_ad_account_id: accountId,
            meta_campaign_id: r.campaign_id,
            campaign_name: r.campaign_name || nameById.get(r.campaign_id) || null,
            platform: 'Meta Ads',
            stat_date: r.date_start,
            spend: parseFloat(r.spend) || 0,
            impressions: parseInt(r.impressions) || 0,
            clicks: parseInt(r.clicks) || 0,
            conversions: conv,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        dUrl = res.paging?.next || null;
        dPages++;
      }

      for (let i = 0; i < daily.length; i += 500) {
        const { error: upErr } = await supabase
          .from('marketing_ad_daily_stats')
          .upsert(daily.slice(i, i + 500) as any, { onConflict: 'user_id,meta_ad_account_id,meta_campaign_id,stat_date' });
        if (upErr) { console.error('daily upsert error:', upErr.message); break; }
      }
      dailyRows = daily.length;
    } catch (e) {
      console.error('daily snapshots failed:', e);
    }

    return new Response(JSON.stringify({ success: true, count: rows.length, dailyRows }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {

    console.error('sync-meta-campaigns error:', e);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
