import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { CR_PRODUCT_ID, documentNumbers, record } from "../_shared/rykaPay.ts";
import { hasPaidInvoice, portfolioContractFromSale, portfolioContractFromStripe, portfolioContractsFromPay, type PayPortfolio, type PortfolioClinic, type PortfolioContract } from "../_shared/rykaPayPortfolio.ts";

const BASE = "https://rykapay.app/api/public/v1";
// Same fixed account as rykapay-read: one company's credential must never serve another account.
const ROY_ACCOUNT = "796e7970-fd93-4574-a871-6090624cace6";
const ITEM_FIELD = "033b91fb-3add-4c96-aec9-567fefbd0fb2";
// Deal custom fields "CPF ou CNPJ" / "CPF/CNPJ (NF)" and "E-mail para envio da NF" / "Mentorado - E-mail".
const DEAL_DOCUMENT_FIELDS = ["de5d8543-287e-4ad9-917a-813d48d0d3eb", "d177b69b-b95c-439c-b52e-8f7117866619"];
const DEAL_EMAIL_FIELDS = ["60ecd631-99b1-44c5-8bda-48b7ac2372b5", "383e0309-652a-428c-9ac7-6fca0b79f56a"];
const SALE_ID = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_DEALS = 400;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const validEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 254 && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(v.trim());
const chunks = <T>(list: T[], size = 80) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  const auth = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth?.startsWith("Bearer ") || !url || !anon) return reply({ error: "Entre no ROY para consultar." }, 401);
  // Every ROY read runs as the caller: the portfolio never shows more than their own RLS allows.
  const db = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: claims, error: authError } = await db.auth.getClaims(auth.slice(7));
  const uid = claims?.claims?.sub;
  if (authError || !uid) return reply({ error: "Sessão inválida." }, 401);
  const { data: me, error: meError } = await db.from("users").select("account_id,is_active").eq("auth_user_id", uid).maybeSingle();
  if (meError || !me || me.is_active === false || me.account_id !== ROY_ACCOUNT) return reply({ error: "Integração indisponível para esta conta." }, 403);
  // Managers, or people granted the "Assinaturas" item in their permission profile.
  const { data: allowed, error: allowedError } = await db.rpc("can_view_pay_portfolio");
  if (allowedError || allowed !== true) return reply({ error: "O painel de assinaturas é só para a gestão ou para quem a gestão liberou." }, 403);
  const key = Deno.env.get("RYKAPAY_API_KEY");
  if (!key) return reply({ error: "Chave RykaPay não configurada." }, 503);

  try {
    let partial = false;
    const must = <T>(res: { data: T | null; error: unknown }): T => { if (res.error || res.data === null) throw new Error("roy_read_failed"); return res.data; };
    // Raw provider bodies carry payer identities and tokens: never returned or logged.
    const cache = new Map<string, Promise<Record<string, unknown> | null>>();
    const pay = (path: string): Promise<Record<string, unknown> | null> => {
      let hit = cache.get(path);
      if (!hit) {
        hit = fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000), redirect: "error" })
          .then(async response => {
            if (response.status === 404) { await response.body?.cancel(); return null; }
            if (!response.ok) { await response.body?.cancel(); partial = true; return null; }
            return record(record(await response.json()).dados);
          })
          .catch(() => { partial = true; return null; });
        cache.set(path, hit);
      }
      return hit;
    };

    // Won deals whose Item da Venda is the Clínica Ryka program (product UUID or the option with the product's name).
    const product = must(await db.from("products").select("name").eq("id", CR_PRODUCT_ID).eq("account_id", me.account_id).maybeSingle());
    const field = must(await db.from("custom_fields").select("options").eq("id", ITEM_FIELD).eq("account_id", me.account_id).maybeSingle());
    const itemValues = [CR_PRODUCT_ID, ...(Array.isArray(field.options) ? field.options.map(record) : [])
      .filter(o => o.label === product.name && typeof o.value === "string").map(o => o.value as string)];
    const itemRows = must(await db.from("deal_field_values").select("deal_id").eq("field_id", ITEM_FIELD).in("value_text", itemValues).eq("account_id", me.account_id).limit(5000));
    const candidateIds = [...new Set(itemRows.map(r => r.deal_id as string))];
    type Deal = { id: string; title: string | null; client_id: string | null; lead_id: string | null; responsible_user_id: string | null; won_at: string | null };
    const deals: Deal[] = [];
    for (const ids of chunks(candidateIds)) {
      deals.push(...must(await db.from("deals").select("id,title,client_id,lead_id,responsible_user_id,won_at").in("id", ids).eq("account_id", me.account_id).eq("status", "won").is("deleted_at", null)) as Deal[]);
    }
    deals.sort((a, b) => String(b.won_at ?? "").localeCompare(String(a.won_at ?? "")));
    if (deals.length > MAX_DEALS) { deals.length = MAX_DEALS; partial = true; }
    const dealIds = deals.map(d => d.id);
    const idsOf = (pick: (d: Deal) => string | null) => [...new Set(deals.map(pick).filter((v): v is string => Boolean(v)))];
    const load = async <T>(ids: string[], run: (part: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
      const out: T[] = [];
      for (const part of chunks(ids)) out.push(...must(await run(part)));
      return out;
    };
    type Person = { id: string; full_name: string | null; company_name: string | null; cpf: string | null; cnpj: string | null; emails: unknown; email?: string | null };
    const [clients, leads, sellers, fields, links, payers] = await Promise.all([
      load<Person>(idsOf(d => d.client_id), p => db.from("clients").select("id,full_name,company_name,cpf,cnpj,emails").in("id", p).eq("account_id", me.account_id)),
      load<Person>(idsOf(d => d.lead_id), p => db.from("leads").select("id,full_name,company_name,cpf,cnpj,email,emails").in("id", p).eq("account_id", me.account_id)),
      load<{ id: string; name: string | null }>(idsOf(d => d.responsible_user_id), p => db.from("users").select("id,name").in("id", p).eq("account_id", me.account_id)),
      load<{ deal_id: string; field_id: string; value_text: string | null }>(dealIds, p => db.from("deal_field_values").select("deal_id,field_id,value_text").in("deal_id", p).in("field_id", [...DEAL_DOCUMENT_FIELDS, ...DEAL_EMAIL_FIELDS]).eq("account_id", me.account_id)),
      load<{ deal_id: string; source: string; external_id: string }>(dealIds, p => db.from("pay_sale_links").select("deal_id,source,external_id").in("deal_id", p).eq("account_id", me.account_id)),
      db.from("pay_third_party_payers").select("client_id,lead_id,origin_deal_id,document,email").eq("account_id", me.account_id).limit(2000).then(must),
    ]);
    const stripeIds = [...new Set(links.filter(l => l.source === "stripe_legacy").map(l => l.external_id))];
    const seeds = await load<{ external_id: string; payer_email: string }>(stripeIds, p => db.from("pay_orphan_seed").select("external_id,payer_email").in("external_id", p).eq("account_id", me.account_id));
    const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map(r => [r.id, r]));
    const clientMap = byId(clients), leadMap = byId(leads), sellerMap = byId(sellers);
    const seedMap = new Map(seeds.map(s => [s.external_id, s.payer_email]));

    // A contract belongs to one clinic only: the most recently won deal that reaches it.
    const claimed = new Set<string>();
    const readDeal = async (deal: Deal): Promise<PortfolioClinic> => {
      const client = deal.client_id ? clientMap.get(deal.client_id) : undefined;
      const lead = deal.lead_id ? leadMap.get(deal.lead_id) : undefined;
      const docs = new Set<string>(), emails = new Set<string>();
      const addDoc = (v: unknown) => { const doc = documentNumbers(v); if (doc && docs.size < 6) docs.add(doc); };
      const addEmail = (v: unknown) => { for (const part of Array.isArray(v) ? v : [v]) if (validEmail(part) && emails.size < 6) emails.add(part.trim().toLowerCase()); };
      for (const person of [client, lead]) if (person) { addDoc(person.cpf); addDoc(person.cnpj); addEmail(person.email); addEmail(person.emails); }
      for (const row of fields) if (row.deal_id === deal.id) (DEAL_EMAIL_FIELDS.includes(row.field_id) ? addEmail : addDoc)(row.value_text);
      const dealPayers = payers.filter(p => (deal.client_id && p.client_id === deal.client_id) || (deal.lead_id && p.lead_id === deal.lead_id) || p.origin_deal_id === deal.id);
      const dealLinks = links.filter(l => l.deal_id === deal.id);

      const found: PortfolioContract[] = [];
      const take = (contracts: PortfolioContract[]) => { for (const c of contracts) if (hasPaidInvoice(c) && !found.some(f => f.id === c.id)) found.push(c); };
      const lookup = async (param: "documento" | "email", value: string) => {
        const data = await pay(`/clientes/pagamentos?${param}=${encodeURIComponent(value)}`);
        if (!data) return;
        const read = portfolioContractsFromPay(data);
        partial ||= read.partial;
        take(read.contracts);
      };
      for (const doc of docs) await lookup("documento", doc);
      // E-mail and approved third-party payers are only tried when the clinic's own documents found nothing.
      if (!found.length) for (const email of emails) await lookup("email", email);
      if (!found.length) for (const payer of dealPayers) {
        const doc = documentNumbers(payer.document);
        if (doc) await lookup("documento", doc);
        if (!found.length && validEmail(payer.email)) await lookup("email", payer.email.trim().toLowerCase());
        if (found.length) break;
      }
      if (!found.length) for (const link of dealLinks) {
        if (link.source !== "rykapay" || !SALE_ID.test(link.external_id)) continue;
        const sale = await pay(`/cobrancas/${link.external_id}`);
        const contract = sale && portfolioContractFromSale(sale);
        if (contract) take([contract]);
      }
      for (const link of dealLinks) {
        if (link.source !== "stripe_legacy" || found.some(c => c.id === link.external_id)) continue;
        const email = seedMap.get(link.external_id);
        const data = validEmail(email) ? await pay(`/clientes/pagamentos?email=${encodeURIComponent(email.trim().toLowerCase())}`) : null;
        if (!data) continue;
        const contract = portfolioContractFromStripe(data.stripe, link.external_id);
        if (contract === null) partial = true;
        else if (contract) take([contract]);
      }
      const contracts = found.filter(c => !claimed.has(c.id));
      for (const c of contracts) claimed.add(c.id);
      const hasKey = docs.size || emails.size || dealPayers.length || dealLinks.length;
      return {
        dealId: deal.id,
        // A name needs at least one letter: placeholders typed into the record ("0", "-") are skipped.
        name: ([client?.company_name, client?.full_name, lead?.company_name, lead?.full_name, deal.title].find(v => typeof v === "string" && /\p{L}/u.test(v)) || "Clínica sem nome").trim().slice(0, 160),
        sellerId: deal.responsible_user_id,
        sellerName: (deal.responsible_user_id && sellerMap.get(deal.responsible_user_id)?.name?.trim()) || null,
        wonAt: deal.won_at,
        state: contracts.length ? "found" : hasKey ? "not_found" : "needs_document",
        contracts,
      };
    };
    // In won order, a few at a time: the provider is never flooded and claims stay deterministic enough.
    const clinics: PortfolioClinic[] = [];
    for (const batch of chunks(deals, 4)) clinics.push(...await Promise.all(batch.map(readDeal)));
    const body: PayPortfolio = { generatedAt: new Date().toISOString(), partial, clinics };
    // Keep the last read so the page opens at once for the next visitor of the same scope
    // (management shares the whole portfolio; anyone else keeps their own RLS-limited read).
    // The scope is decided by the database for the caller, never taken from the request.
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const { data: scope } = await db.rpc("pay_portfolio_snapshot_scope");
      if (serviceKey && typeof scope === "string" && scope) {
        const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
        // An incomplete read never replaces a complete one; it is only kept when nothing is stored yet.
        await admin.from("pay_portfolio_snapshots").upsert(
          { account_id: me.account_id, scope_key: scope, data: body, generated_at: body.generatedAt, refreshed_by: uid, updated_at: body.generatedAt },
          { onConflict: "account_id,scope_key", ignoreDuplicates: partial },
        );
      }
    } catch { /* storing is best effort: the read itself already succeeded */ }
    return reply(body);
  } catch {
    return reply({ error: "Não foi possível montar o painel de assinaturas. Tente novamente." }, 502);
  }
});
