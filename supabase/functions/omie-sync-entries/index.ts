// Sincroniza Contas a Pagar e Receber do Omie para public.financial_entries.
// Aceita { company_id?, months_back?, months_forward? } ou roda em modo cron (sem body) para todos os defaults.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOmie(endpoint: string, call: string, param: any, appKey: string, appSecret: string) {
  const res = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call, app_key: appKey, app_secret: appSecret, param: [param] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Omie ${call} ${res.status}: ${text}`);
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

function fmtBR(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
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

async function syncCompany(admin: any, accountId: string, company: any, monthsBack: number, monthsForward: number) {
  const { app_key, app_secret, id: companyId } = company;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + monthsForward + 1, 0);

  // Carrega clientes para match por CPF/CNPJ
  const { data: clients } = await admin
    .from('clients')
    .select('id, cpf_cnpj')
    .eq('account_id', accountId);
  const clientMap = new Map<string, string>();
  for (const c of (clients || [])) {
    const k = cleanDoc(c.cpf_cnpj);
    if (k) clientMap.set(k, c.id);
  }

  let totalReceber = 0, totalPagar = 0, errors: string[] = [];

  // Helper de paginação anti-flood
  async function fetchAll(endpoint: string, call: string, listKey: string, dateField: string) {
    const all: any[] = [];
    let page = 1;
    while (page <= 50) {
      const param: any = {
        pagina: page,
        registros_por_pagina: 50,
        filtrar_por_data_de: fmtBR(start),
        filtrar_por_data_ate: fmtBR(end),
      };
      const r = await callOmie(endpoint, call, param, app_key, app_secret);
      const items = r[listKey] || [];
      all.push(...items);
      const total = r.total_de_paginas || 1;
      if (page >= total) break;
      page++;
      await sleep(500); // anti-flood Omie
    }
    return all;
  }

  // CONTAS A RECEBER
  try {
    const receber = await fetchAll('financas/contareceber', 'ListarContasReceber', 'conta_receber_cadastro', 'data_vencimento');
    for (const r of receber) {
      const due = parseBR(r.data_vencimento);
      const valor = Number(r.valor_documento) || 0;
      const pago = Number(r.valor_pago_soma) || 0;
      const omieId = String(r.codigo_lancamento_omie);
      const docCli = cleanDoc(r.cnpj_cpf_cliente || r.cnpj_cpf);
      const clientId = docCli ? clientMap.get(docCli) || null : null;

      const row = {
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

      const { error } = await admin
        .from('financial_entries')
        .upsert(row, { onConflict: 'account_id,omie_id' });
      if (error) errors.push(`Receber ${omieId}: ${error.message}`);
      else totalReceber++;
    }
  } catch (e: any) {
    errors.push(`ListarContasReceber: ${e.message}`);
  }

  await sleep(800);

  // CONTAS A PAGAR
  try {
    const pagar = await fetchAll('financas/contapagar', 'ListarContasPagar', 'conta_pagar_cadastro', 'data_vencimento');
    for (const p of pagar) {
      const due = parseBR(p.data_vencimento);
      const valor = Number(p.valor_documento) || 0;
      const pago = Number(p.valor_pago_soma) || 0;
      const omieId = String(p.codigo_lancamento_omie);

      const row = {
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

      const { error } = await admin
        .from('financial_entries')
        .upsert(row, { onConflict: 'account_id,omie_id' });
      if (error) errors.push(`Pagar ${omieId}: ${error.message}`);
      else totalPagar++;
    }
  } catch (e: any) {
    errors.push(`ListarContasPagar: ${e.message}`);
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
    const monthsBack = Math.max(0, Math.min(24, Number(body.months_back) || 12));
    const monthsForward = Math.max(0, Math.min(24, Number(body.months_forward) || 12));
    const explicitCompanyId = body.company_id as string | undefined;
    const cronMode = body.cron === true;

    let companies: any[] = [];

    if (explicitCompanyId) {
      // Modo manual: pega CNPJ específico, descobre account via JWT
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      const { data: userRes } = await admin.auth.getUser(token);
      if (!userRes?.user) throw new Error('Não autenticado');
      const { data: userRow } = await admin
        .from('users')
        .select('account_id')
        .eq('auth_user_id', userRes.user.id)
        .maybeSingle();
      if (!userRow?.account_id) throw new Error('Account não encontrada');

      const { data } = await admin
        .from('omie_settings')
        .select('id, account_id, app_key, app_secret')
        .eq('id', explicitCompanyId)
        .eq('account_id', userRow.account_id);
      companies = data || [];
    } else if (cronMode) {
      // Cron: roda todos os CNPJs configurados
      const { data } = await admin
        .from('omie_settings')
        .select('id, account_id, app_key, app_secret')
        .not('app_key', 'is', null)
        .not('app_secret', 'is', null);
      companies = data || [];
    } else {
      // Manual sem company_id: pega o default do usuário logado
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      const { data: userRes } = await admin.auth.getUser(token);
      if (!userRes?.user) throw new Error('Não autenticado');
      const { data: userRow } = await admin
        .from('users')
        .select('account_id')
        .eq('auth_user_id', userRes.user.id)
        .maybeSingle();
      if (!userRow?.account_id) throw new Error('Account não encontrada');

      const { data } = await admin
        .from('omie_settings')
        .select('id, account_id, app_key, app_secret')
        .eq('account_id', userRow.account_id)
        .order('is_default', { ascending: false })
        .limit(1);
      companies = data || [];
    }

    const results: any[] = [];
    for (const company of companies) {
      try {
        const r = await syncCompany(admin, company.account_id, company, monthsBack, monthsForward);
        results.push({ company_id: company.id, ...r });
        // Marca último sync no settings
        await admin
          .from('omie_settings')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', company.id);
      } catch (e: any) {
        results.push({ company_id: company.id, error: e.message });
      }
      await sleep(1000);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('omie-sync-entries error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
