import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOmie(endpoint: string, call: string, param: any, appKey: string, appSecret: string, attempt = 0): Promise<any> {
  const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call, app_key: appKey, app_secret: appSecret, param: [param] }),
  });
  const text = await res.text();
  // Handle Omie redundant-call rate limit with retries
  if (text.includes('REDUNDANT') || text.includes('Consumo redundante')) {
    if (attempt < 2) {
      const waitMs = 52000;
      console.warn(`Omie REDUNDANT on ${call}, waiting ${waitMs}ms (attempt ${attempt + 1})`);
      await sleep(waitMs);
      return callOmie(endpoint, call, param, appKey, appSecret, attempt + 1);
    }
    const err: any = new Error(`Omie ${call}: rate limited (REDUNDANT)`);
    err.code = 'OMIE_REDUNDANT';
    throw err;
  }
  if (!res.ok) throw new Error(`Omie ${call} ${res.status}: ${text}`);
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`Omie ${call}: invalid JSON`); }
  if (json.faultstring) throw new Error(`Omie: ${json.faultstring}`);
  return json;
}

function parseBR(d?: string): Date | null {
  if (!d) return null;
  const [day, month, year] = d.split('/');
  if (!day || !month || !year) return null;
  return new Date(`${year}-${month}-${day}T00:00:00`);
}

function fmtBR(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

async function listAllPages(
  endpoint: string,
  call: string,
  baseParam: any,
  listKey: string,
  appKey: string,
  appSecret: string,
) {
    const all: any[] = [];
    let page = 1;
    while (page <= 30) {
      const r = await callOmie(endpoint, call, { ...baseParam, pagina: page, registros_por_pagina: 500 }, appKey, appSecret);
      const items = r[listKey] || [];
      all.push(...items);
      const total = r.total_de_paginas || 1;
      if (page >= total) break;
      page++;
      await sleep(250);
    }
    return all;
  }



Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const months = Math.max(1, Math.min(12, Number(body.months) || 6));
    const companyId = body.company_id as string | undefined;

    // Auth: get user from JWT to discover account_id
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userRes } = await admin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) throw new Error('Não autenticado');

    const { data: userRow } = await admin
      .from('users')
      .select('account_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    const accountId = userRow?.account_id;
    if (!accountId) throw new Error('Account não encontrada');

    // Load Omie credentials: by company_id or default for the account
    let credQuery = admin
      .from('omie_settings')
      .select('id, app_key, app_secret, cnpj, legal_name, trade_name, color, is_default')
      .eq('account_id', accountId);
    if (companyId) credQuery = credQuery.eq('id', companyId);
    else credQuery = credQuery.order('is_default', { ascending: false }).limit(1);

    const { data: creds } = await credQuery;
    const cred = creds && creds.length > 0 ? creds[0] : null;
    if (!cred || !cred.app_key || !cred.app_secret) {
      // Fallback to env vars (legacy single-account setup)
      const envKey = Deno.env.get('OMIE_APP_KEY');
      const envSecret = Deno.env.get('OMIE_APP_SECRET');
      if (!envKey || !envSecret) {
        throw new Error('Nenhum CNPJ Omie configurado. Adicione um em /financial/integracoes/omie.');
      }
    }

    const appKey = cred?.app_key || Deno.env.get('OMIE_APP_KEY')!;
    const appSecret = cred?.app_secret || Deno.env.get('OMIE_APP_SECRET')!;

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const receberFilter: Record<string, unknown> = {};
    const pagarFilter: Record<string, unknown> = {};
    const periodStart = start;
    const periodEnd = end;

    // Serialize to avoid Omie REDUNDANT rate-limit triggered by parallel calls
    const receber = await listAllPages('financas/contareceber', 'ListarContasReceber', receberFilter, 'conta_receber_cadastro', appKey, appSecret);
    await sleep(500);
    const pagar = await listAllPages('financas/contapagar', 'ListarContasPagar', pagarFilter, 'conta_pagar_cadastro', appKey, appSecret);

    const isPaid = (status: string) => status === 'LIQUIDADO';
    const isCancelled = (status: string) => status === 'CANCELADO';
    const isOverdue = (status: string, due: Date | null) =>
      status === 'ATRASADO' || (status !== 'LIQUIDADO' && status !== 'CANCELADO' && due !== null && due < today);

    let totalReceived = 0, totalToReceive = 0, totalOverdueReceive = 0;
    let totalPaid = 0, totalToPay = 0, totalOverduePay = 0;
    let countReceivedTitles = 0;

    const monthsMap = new Map<string, { label: string; received: number; expected: number; paid: number; toPay: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(key, {
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        received: 0, expected: 0, paid: 0, toPay: 0,
      });
    }

    const clientTotals = new Map<number, { name: string; total: number }>();
    const categoryTotals = new Map<string, number>();

    for (const r of receber) {
      if (isCancelled(r.status_titulo)) continue;
      const due = parseBR(r.data_vencimento);
      if (!due || due < periodStart || due > periodEnd) continue;
      const valor = Number(r.valor_documento) || 0;
      const pago = Number(r.valor_pago_soma) || 0;
      const aberto = Math.max(0, valor - pago);
      const key = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthsMap.get(key);
      if (isPaid(r.status_titulo)) {
        totalReceived += valor;
        countReceivedTitles++;
        if (bucket) bucket.received += valor;
        const cli = r.codigo_cliente_fornecedor;
        if (cli) {
          const cur = clientTotals.get(cli) || { name: r.nome_cliente_fornecedor || `Cliente #${cli}`, total: 0 };
          cur.total += valor;
          clientTotals.set(cli, cur);
        }
      } else {
        totalToReceive += aberto;
        if (bucket) bucket.expected += valor;
        if (isOverdue(r.status_titulo, due)) totalOverdueReceive += aberto;
      }
    }

    for (const p of pagar) {
      if (isCancelled(p.status_titulo)) continue;
      const due = parseBR(p.data_vencimento);
      if (!due || due < periodStart || due > periodEnd) continue;
      const valor = Number(p.valor_documento) || 0;
      const pago = Number(p.valor_pago_soma) || 0;
      const aberto = Math.max(0, valor - pago);
      const key = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthsMap.get(key);
      if (isPaid(p.status_titulo)) {
        totalPaid += valor;
        if (bucket) bucket.paid += valor;
        const cat = p.categoria || p.codigo_categoria || 'Sem categoria';
        categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + valor);
      } else {
        totalToPay += aberto;
        if (bucket) bucket.toPay += valor;
        if (isOverdue(p.status_titulo, due)) totalOverduePay += aberto;
      }
    }

    const monthly = Array.from(monthsMap.values());
    const topClients = Array.from(clientTotals.values()).sort((a, b) => b.total - a.total).slice(0, 10);
    const topCategories = Array.from(categoryTotals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const result = {
      window: { months, start: fmtBR(start), end: fmtBR(end) },
      company: cred ? {
        id: cred.id,
        cnpj: cred.cnpj,
        legal_name: cred.legal_name,
        trade_name: cred.trade_name,
        color: cred.color,
      } : null,
      kpis: {
        totalReceived, totalToReceive, totalOverdueReceive,
        avgTicketReceived: countReceivedTitles > 0 ? totalReceived / countReceivedTitles : 0,
        totalPaid, totalToPay, totalOverduePay,
        netResult: totalReceived - totalPaid,
      },
      monthly, topClients, topCategories,
      counts: { receberTitles: receber.length, pagarTitles: pagar.length },
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('omie-dashboard-metrics error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
