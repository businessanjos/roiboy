// Sincroniza Contas a Pagar e Receber do Omie para public.financial_entries.
// Aceita { company_id?, cron? }. Em cron, roda todos os CNPJs configurados.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function callOmie(endpoint: string, call: string, param: any, appKey: string, appSecret: string) {
  const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call, app_key: appKey, app_secret: appSecret, param: [param] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Omie ${call} ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  if (json.faultstring) throw new Error(`Omie: ${json.faultstring}`);
  return json;
}

function parseBR(d?: string): string | null {
  if (!d) return null;
  const [day, month, year] = d.split('/');
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function mapStatus(omieStatus: string, dueDate: string | null, paid: number, valor: number): string {
  if (omieStatus === 'CANCELADO') return 'cancelled';
  if (omieStatus === 'LIQUIDADO' || (paid >= valor && valor > 0)) return 'paid';
  if (paid > 0 && paid < valor) return 'partially_paid';
  if (dueDate && new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10))) return 'overdue';
  return 'pending';
}

function cleanDoc(s?: string): string {
  return (s || '').replace(/\D/g, '');
}

async function listAllPages(endpoint: string, call: string, listKey: string, appKey: string, appSecret: string) {
  const all: any[] = [];
  let page = 1;
  while (page <= 50) {
    const r = await callOmie(endpoint, call, { pagina: page, registros_por_pagina: 500 }, appKey, appSecret);
    const items = r[listKey] || [];
    all.push(...items);
    const total = r.total_de_paginas || 1;
    console.log(`[${call}] page ${page}/${total} - ${items.length} items (total acumulado: ${all.length})`);
    if (page >= total) break;
    page++;
  }
  return all;
}

async function syncCompany(admin: any, accountId: string, company: any) {
  const { app_key, app_secret, id: companyId } = company;
  console.log(`[sync] start company=${companyId} account=${accountId}`);

  const { data: clients } = await admin
    .from('clients')
    .select('id, cpf_cnpj')
    .eq('account_id', accountId);
  const clientMap = new Map<string, string>();
  for (const c of (clients || [])) {
    const k = cleanDoc(c.cpf_cnpj);
    if (k) clientMap.set(k, c.id);
  }
  console.log(`[sync] ${clientMap.size} clients indexed for matching`);

  const errors: string[] = [];
  let totalReceber = 0, totalPagar = 0;

  // RECEBER
  try {
    const receber = await listAllPages('financas/contareceber', 'ListarContasReceber', 'conta_receber_cadastro', app_key, app_secret);
    const rows = receber.map((r: any) => {
      const due = parseBR(r.data_vencimento);
      const valor = Number(r.valor_documento) || 0;
      const pago = Number(r.valor_pago_soma) || 0;
      const omieId = String(r.codigo_lancamento_omie);
      const docCli = cleanDoc(r.cnpj_cpf_cliente || r.cnpj_cpf);
      const clientId = docCli ? clientMap.get(docCli) || null : null;
      return {
        account_id: accountId,
        company_id: companyId,
        entry_type: 'receivable',
        description: r.observacao || r.numero_documento || `Receber Omie #${omieId}`,
        amount: valor,
        due_date: due,
        payment_date: parseBR(r.data_pagamento),
        status: mapStatus(r.status_titulo, due, pago, valor),
        client_id: clientId,
        document_number: r.numero_documento || null,
        currency: 'BRL',
        omie_id: omieId,
        omie_payload: r,
        last_omie_sync_at: new Date().toISOString(),
        source: 'omie',
        issue_date: parseBR(r.data_emissao),
      };
    });
    // Upsert em lotes de 200
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await admin.from('financial_entries').upsert(batch, { onConflict: 'account_id,omie_id' });
      if (error) errors.push(`Receber batch ${i}: ${error.message}`); console.error(`Receber batch ${i} ERROR:`, error.message, error.details, error.hint);
      else totalReceber += batch.length;
    }
    console.log(`[sync] receber upserted=${totalReceber}`);
  } catch (e: any) {
    errors.push(`ListarContasReceber: ${e.message}`);
    console.error('Receber err:', e.message);
  }

  // PAGAR
  try {
    const pagar = await listAllPages('financas/contapagar', 'ListarContasPagar', 'conta_pagar_cadastro', app_key, app_secret);
    const rows = pagar.map((p: any) => {
      const due = parseBR(p.data_vencimento);
      const valor = Number(p.valor_documento) || 0;
      const pago = Number(p.valor_pago_soma) || 0;
      const omieId = String(p.codigo_lancamento_omie);
      return {
        account_id: accountId,
        company_id: companyId,
        entry_type: 'payable',
        description: p.observacao || p.numero_documento || `Pagar Omie #${omieId}`,
        amount: valor,
        due_date: due,
        payment_date: parseBR(p.data_pagamento),
        status: mapStatus(p.status_titulo, due, pago, valor),
        document_number: p.numero_documento || null,
        currency: 'BRL',
        omie_id: omieId,
        omie_payload: p,
        last_omie_sync_at: new Date().toISOString(),
        source: 'omie',
        issue_date: parseBR(p.data_emissao),
      };
    });
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await admin.from('financial_entries').upsert(batch, { onConflict: 'account_id,omie_id' });
      if (error) errors.push(`Pagar batch ${i}: ${error.message}`); console.error(`Pagar batch ${i} ERROR:`, error.message, error.details, error.hint);
      else totalPagar += batch.length;
    }
    console.log(`[sync] pagar upserted=${totalPagar}`);
  } catch (e: any) {
    errors.push(`ListarContasPagar: ${e.message}`);
    console.error('Pagar err:', e.message);
  }

  return { totalReceber, totalPagar, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const explicitCompanyId = body.company_id as string | undefined;
    const cronMode = body.cron === true;

    let companies: any[] = [];

    if (explicitCompanyId) {
      const { data } = await admin
        .from('omie_settings')
        .select('id, account_id, app_key, app_secret')
        .eq('id', explicitCompanyId);
      companies = data || [];
    } else if (cronMode) {
      const { data } = await admin
        .from('omie_settings')
        .select('id, account_id, app_key, app_secret')
        .eq('is_enabled', true)
        .not('app_key', 'is', null)
        .not('app_secret', 'is', null);
      companies = data || [];
    } else {
      // Manual sem company_id: precisa do user logado
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      const { data: userRes } = await admin.auth.getUser(token);
      if (!userRes?.user) throw new Error('Não autenticado');
      const { data: userRow } = await admin
        .from('users').select('account_id').eq('auth_user_id', userRes.user.id).maybeSingle();
      if (!userRow?.account_id) throw new Error('Account não encontrada');
      const { data } = await admin
        .from('omie_settings')
        .select('id, account_id, app_key, app_secret')
        .eq('account_id', userRow.account_id)
        .order('is_default', { ascending: false })
        .limit(1);
      companies = data || [];
    }

    console.log(`[entry] companies=${companies.length}`);

    const results: any[] = [];
    for (const company of companies) {
      try {
        const r = await syncCompany(admin, company.account_id, company);
        results.push({ company_id: company.id, ...r });
      } catch (e: any) {
        console.error('company err:', e.message);
        results.push({ company_id: company.id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('omie-sync-entries fatal:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
