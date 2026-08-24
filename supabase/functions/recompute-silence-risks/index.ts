import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Dias de silêncio a partir dos quais geramos alerta
const WARN_DAYS = 14; // medium
const HIGH_DAYS = 30; // high
// Não repetir alerta para o mesmo cliente dentro desta janela
const DEDUPE_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // 1) Clientes ativos
    const clients: { id: string; account_id: string; status: string }[] = [];
    for (let page = 0; ; page++) {
      const { data, error: clientsErr } = await supabase
        .from('clients')
        .select('id, account_id, status')
        .in('status', ['active', 'churn_risk', 'paused'])
        .range(page * 1000, page * 1000 + 999);
      if (clientsErr) throw clientsErr;
      if (!data?.length) break;
      clients.push(...(data as typeof clients));
      if (data.length < 1000) break;
    }
    if (!clients?.length) {
      return json({ ok: true, evaluated: 0, created: 0 });
    }

    const clientIds = clients.map((c) => c.id);

    // 2) Última interação viva por cliente:
    //    max(zapp_messages.sent_at) + max(client_checkins.happened_at) + clients.recent_activity_at
    const lastByClient = new Map<string, string>();
    const { data: activity, error: actErr } = await supabase.rpc('client_last_live_activity');
    if (actErr) throw actErr;
    (activity ?? []).forEach((row: { client_id: string; last_at: string | null }) => {
      if (!row.last_at) return;
      if (new Date(row.last_at).getFullYear() < 2000) return; // 'epoch' = sem histórico
      lastByClient.set(row.client_id, row.last_at);
    });


    // 5) Alertas recentes para dedupe
    const since = new Date(Date.now() - DEDUPE_DAYS * 86400000).toISOString();
    const { data: recentRisks, error: rrErr } = await supabase
      .from('risk_events')
      .select('client_id')
      .eq('source', 'system')
      .gte('created_at', since);
    if (rrErr) throw rrErr;
    const recent = new Set((recentRisks ?? []).map((r) => r.client_id));

    const now = Date.now();
    const rows: Record<string, unknown>[] = [];

    for (const c of clients) {
      if (recent.has(c.id)) continue;
      const last = lastByClient.get(c.id);
      if (!last) continue; // sem histórico vivo: não inventamos silêncio
      const days = Math.floor((now - new Date(last).getTime()) / 86400000);
      if (days < WARN_DAYS) continue;
      rows.push({
        account_id: c.account_id,
        client_id: c.id,
        source: 'system',
        risk_level: days >= HIGH_DAYS ? 'high' : 'medium',
        reason: `Silêncio de ${days} dias (sem mensagens no RoyZapp nem check-ins de CS)`,
        happened_at: new Date().toISOString(),
      });
    }

    let created = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from('risk_events').insert(rows.slice(i, i + 200));
      if (error) throw error;
      created += rows.slice(i, i + 200).length;
    }

    return json({ ok: true, evaluated: clients.length, withActivity: lastByClient.size, created });
  } catch (e) {
    console.error('recompute-silence-risks failed:', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
