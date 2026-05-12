import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OMIE_APP_KEY = Deno.env.get('OMIE_APP_KEY');
const OMIE_APP_SECRET = Deno.env.get('OMIE_APP_SECRET');

async function callOmie(endpoint: string, call: string, param: any) {
  const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      call,
      app_key: OMIE_APP_KEY,
      app_secret: OMIE_APP_SECRET,
      param: [param],
    }),
  });
  if (!res.ok) throw new Error(`Omie ${call} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.faultstring) throw new Error(`Omie: ${json.faultstring}`);
  return json;
}

// DD/MM/YYYY -> Date
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

async function listAllPages(endpoint: string, call: string, baseParam: any, listKey: string) {
  const all: any[] = [];
  let page = 1;
  // safety cap to avoid runaway pagination
  while (page <= 30) {
    const r = await callOmie(endpoint, call, { ...baseParam, pagina: page, registros_por_pagina: 500 });
    const items = r[listKey] || [];
    all.push(...items);
    const total = r.total_de_paginas || 1;
    if (page >= total) break;
    page++;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
      throw new Error('Credenciais Omie não configuradas (OMIE_APP_KEY / OMIE_APP_SECRET).');
    }

    const body = await req.json().catch(() => ({}));
    const months = Math.max(1, Math.min(12, Number(body.months) || 6));

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0); // end of current month

    const baseFilter = {
      data_de: fmtBR(start),
      data_ate: fmtBR(end),
      filtrar_por_data_de: 'VENCIMENTO',
    };

    // Fetch all pages (receber + pagar) in parallel
    const [receber, pagar] = await Promise.all([
      listAllPages('financas/contareceber', 'ListarContasReceber', baseFilter, 'conta_receber_cadastro'),
      listAllPages('financas/contapagar', 'ListarContasPagar', baseFilter, 'conta_pagar_cadastro'),
    ]);

    const isPaid = (status: string) => status === 'LIQUIDADO';
    const isCancelled = (status: string) => status === 'CANCELADO';
    const isOverdue = (status: string, due: Date | null) =>
      status === 'ATRASADO' || (status !== 'LIQUIDADO' && status !== 'CANCELADO' && due !== null && due < today);

    // Aggregations
    let totalReceived = 0, totalToReceive = 0, totalOverdueReceive = 0;
    let totalPaid = 0, totalToPay = 0, totalOverduePay = 0;
    let countReceivedTitles = 0;

    // Monthly buckets
    const monthsMap = new Map<string, { label: string; received: number; expected: number; paid: number; toPay: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(key, {
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        received: 0,
        expected: 0,
        paid: 0,
        toPay: 0,
      });
    }

    // Top clients (receber) and category breakdown (pagar)
    const clientTotals = new Map<number, { name: string; total: number }>();
    const categoryTotals = new Map<string, number>();

    for (const r of receber) {
      if (isCancelled(r.status_titulo)) continue;
      const due = parseBR(r.data_vencimento);
      const valor = Number(r.valor_documento) || 0;
      const pago = Number(r.valor_pago_soma) || 0;
      const aberto = Math.max(0, valor - pago);
      const key = due ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}` : null;
      const bucket = key ? monthsMap.get(key) : null;

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
      const valor = Number(p.valor_documento) || 0;
      const pago = Number(p.valor_pago_soma) || 0;
      const aberto = Math.max(0, valor - pago);
      const key = due ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}` : null;
      const bucket = key ? monthsMap.get(key) : null;
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
      kpis: {
        totalReceived,
        totalToReceive,
        totalOverdueReceive,
        avgTicketReceived: countReceivedTitles > 0 ? totalReceived / countReceivedTitles : 0,
        totalPaid,
        totalToPay,
        totalOverduePay,
        netResult: totalReceived - totalPaid,
      },
      monthly,
      topClients,
      topCategories,
      counts: {
        receberTitles: receber.length,
        pagarTitles: pagar.length,
      },
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
