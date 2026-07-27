import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const DAY_MS = 86400000;
const toIso = (d: Date) => d.toISOString().split('T')[0];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return json({ error: 'Não autorizado' }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tokenData } = await supabase
      .from('user_meta_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!tokenData) return json({ error: 'Meta não conectado' }, 400);
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return json({ error: 'Token expirado' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const days: number = Math.min(Math.max(Number(body?.days) || 90, 1), 180);
    const force: boolean = !!body?.force;
    const requested: string[] = Array.isArray(body?.adAccountIds)
      ? body.adAccountIds
      : body?.adAccountId
        ? [body.adAccountId]
        : [];

    const normalize = (id: string) => (id.startsWith('act_') ? id : `act_${id}`);
    let accountIds = requested.map(normalize);

    // Sem escopo explícito: usa as contas já conhecidas desse usuário
    if (accountIds.length === 0) {
      const { data: known = [] } = await supabase
        .from('marketing_ad_sets')
        .select('meta_ad_account_id')
        .eq('user_id', user.id);
      accountIds = Array.from(
        new Set(((known as any[]) || []).map((r) => r.meta_ad_account_id).filter(Boolean)),
      );
    }
    if (accountIds.length === 0) return json({ error: 'Nenhuma conta de anúncios para preencher' }, 400);

    const until = toIso(new Date());
    const since = toIso(new Date(Date.now() - days * DAY_MS));

    // Herda o escopo (conta interna / agência) do que já existe para o usuário
    const { data: scope } = await supabase
      .from('marketing_ad_sets')
      .select('account_id, agency_id')
      .eq('user_id', user.id)
      .not('account_id', 'is', null)
      .limit(1)
      .maybeSingle();

    const report: any[] = [];

    for (const accountId of accountIds) {
      // 1) Quais dias já existem?
      const { data: existing = [] } = await supabase
        .from('marketing_ad_daily_stats')
        .select('stat_date')
        .eq('user_id', user.id)
        .eq('meta_ad_account_id', accountId)
        .gte('stat_date', since)
        .lte('stat_date', until);
      const have = new Set(((existing as any[]) || []).map((r) => r.stat_date));

      const expected: string[] = [];
      for (let t = new Date(since).getTime(); t <= new Date(until).getTime(); t += DAY_MS) {
        expected.push(toIso(new Date(t)));
      }
      const missing = expected.filter((d) => !have.has(d));

      if (!force && missing.length === 0) {
        report.push({ accountId, skipped: true, reason: 'já completo', rows: 0 });
        continue;
      }

      // 2) Busca a série diária completa da janela (o Meta só devolve dias com veiculação)
      const rows: any[] = [];
      let url: string | null =
        `https://graph.facebook.com/v21.0/${accountId}/insights?level=campaign&time_increment=1` +
        `&time_range={'since':'${since}','until':'${until}'}` +
        `&fields=campaign_id,campaign_name,spend,impressions,clicks,actions&limit=500` +
        `&access_token=${tokenData.access_token}`;
      let pages = 0;
      let apiError: string | null = null;
      while (url && pages < 60) {
        const res: any = await (await fetch(url)).json();
        if (res.error) { apiError = res.error.message; break; }
        for (const r of (res.data || [])) {
          let conv = 0;
          for (const a of (r.actions || [])) {
            if (['purchase', 'omni_purchase', 'lead', 'complete_registration'].includes(a.action_type)) {
              conv += parseInt(a.value) || 0;
            }
          }
          rows.push({
            user_id: user.id,
            account_id: scope?.account_id ?? null,
            agency_id: scope?.agency_id ?? null,
            meta_ad_account_id: accountId,
            meta_campaign_id: r.campaign_id,
            campaign_name: r.campaign_name || null,
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
        url = res.paging?.next || null;
        pages++;
      }

      if (apiError) {
        console.error('backfill insights error', accountId, apiError);
        report.push({ accountId, error: apiError, rows: 0, missingDays: missing.length });
        continue;
      }

      let saved = 0;
      let upsertError: string | null = null;
      for (let i = 0; i < rows.length; i += 500) {
        const { error: upErr } = await supabase
          .from('marketing_ad_daily_stats')
          .upsert(rows.slice(i, i + 500) as any, {
            onConflict: 'user_id,meta_ad_account_id,meta_campaign_id,stat_date',
          });
        if (upErr) { upsertError = upErr.message; break; }
        saved += rows.slice(i, i + 500).length;
      }

      report.push({
        accountId,
        rows: saved,
        missingDays: missing.length,
        since,
        until,
        ...(upsertError ? { error: upsertError } : {}),
      });
    }

    const totalRows = report.reduce((s, r) => s + (r.rows || 0), 0);
    return json({ success: true, since, until, totalRows, accounts: report });
  } catch (e) {
    console.error('backfill-meta-daily-stats error:', e);
    return json({ error: 'Erro interno' }, 500);
  }
});
