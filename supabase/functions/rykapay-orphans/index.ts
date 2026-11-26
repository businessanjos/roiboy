import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { isClinicaRykaSale, normalizeStripeLegacy, record } from "../_shared/rykaPay.ts";

const BASE = "https://rykapay.app/api/public/v1";
// Same fixed account as rykapay-read: one company's credential must never serve another account.
const ROY_ACCOUNT = "796e7970-fd93-4574-a871-6090624cace6";
// Ownerless sales start here; older RykaPay sales were closed before sales were tied to deals.
const ORPHAN_SINCE = Date.parse("2026-11-26T19:30:00Z");
const SaleId = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }).strict(),
  z.object({
    action: z.literal("decide"),
    requestId: z.string().uuid(),
    source: z.enum(["rykapay", "stripe_legacy"]),
    externalId: SaleId,
    relationship: z.enum(["partner", "spouse", "company_card", "other"]),
    relationshipOther: z.string().trim().max(120).optional(),
    payerDocument: z.string().trim().max(20).optional(),
    payerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  }).strict(),
]);
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const str = (v: unknown, max = 160) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const cents = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  const auth = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth?.startsWith("Bearer ") || !url || !anon) return reply({ error: "Entre no ROY para consultar." }, 401);
  const db = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: claims, error: authError } = await db.auth.getClaims(auth.slice(7));
  const uid = claims?.claims?.sub;
  if (authError || !uid) return reply({ error: "Sessão inválida." }, 401);
  const { data: me, error: meError } = await db.from("users").select("account_id,is_active").eq("auth_user_id", uid).maybeSingle();
  if (meError || !me || me.is_active === false || me.account_id !== ROY_ACCOUNT) return reply({ error: "Integração indisponível para esta conta." }, 403);
  const { data: sales, error: salesError } = await db.rpc("user_has_sector_access", { _auth_user_id: uid, _sector_id: "vendas" });
  if (salesError || sales !== true) return reply({ error: "Sem acesso ao comercial." }, 403);
  const key = Deno.env.get("RYKAPAY_API_KEY");
  if (!key) return reply({ error: "Chave RykaPay não configurada." }, 503);
  // Raw provider bodies carry payer identities and tokens: never returned or logged.
  const pay = (path: string) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000), redirect: "error" });

  try {
    const parsed = Input.safeParse(await req.json());
    if (!parsed.success) return reply({ error: "Pedido inválido." }, 400);
    const input = parsed.data;

    if (input.action === "list") {
      const [{ data: seed, error: seedError }, { data: links, error: linksError }, response] = await Promise.all([
        db.rpc("list_pay_orphan_seed"),
        db.from("pay_sale_links").select("external_id").eq("account_id", me.account_id).eq("source", "rykapay").limit(5000),
        pay("/cobrancas?limite=200"),
      ]);
      if (seedError || linksError) throw new Error("roy_read_failed");
      if (!response.ok) return reply({ error: "RykaPay indisponível. Tente novamente." }, 502);
      const rows = record(await response.json()).dados;
      if (!Array.isArray(rows)) throw new Error("invalid_pay_response");
      const linked = new Set((links ?? []).map(l => l.external_id));
      const orphans = rows.map(record)
        .filter(r => r.status === "paga" && isClinicaRykaSale(r.descricao) && typeof r.criada_em === "string" && Date.parse(r.criada_em) >= ORPHAN_SINCE
          && typeof r.id === "string" && SaleId.safeParse(r.id).success && !linked.has(r.id))
        .map(r => ({ source: "rykapay" as const, id: r.id as string, payerName: str(r.paciente_nome) || "Nome não informado", amountCents: cents(r.valor_total_centavos), date: (r.criada_em as string).slice(0, 10), label: str(r.descricao) }))
        .concat((seed ?? []).map((s: { external_id: string; payer_name: string; amount_cents: number; started_on: string | null }) =>
          ({ source: "stripe_legacy" as const, id: s.external_id, payerName: s.payer_name, amountCents: s.amount_cents, date: s.started_on, label: "Assinatura mensal · legado Stripe" })));
      // The charges list has no continuation: at the ceiling, older ownerless sales may be missing.
      return reply({ orphans, partial: rows.length >= 200 });
    }

    let payerName: string | null = null;
    let amountCents: number | null = null;
    let paidOn: string | null = null;
    if (input.source === "rykapay") {
      const response = await pay(`/cobrancas/${input.externalId}`);
      if (response.status === 404) return reply({ error: "Esta venda não existe mais no RykaPay." }, 409);
      if (!response.ok) return reply({ error: "RykaPay indisponível. Tente novamente." }, 502);
      const sale = record(record(await response.json()).dados);
      if (sale.status !== "paga" || !isClinicaRykaSale(sale.descricao)) return reply({ error: "Esta venda não está paga no RykaPay." }, 409);
      payerName = str(sale.paciente_nome, 200);
      amountCents = cents(sale.valor_total_centavos);
      const received = (Array.isArray(sale.parcelas) ? sale.parcelas : []).map(p => record(p).recebimento).filter((v): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)).sort();
      paidOn = received[0]?.slice(0, 10) ?? null;
    } else {
      const { data: seed, error } = await db.from("pay_orphan_seed").select("payer_email").eq("account_id", me.account_id).eq("external_id", input.externalId).maybeSingle();
      if (error) throw new Error("roy_read_failed");
      if (!seed) return reply({ error: "Somente gestores podem vincular esta venda." }, 403);
      const response = await pay(`/clientes/pagamentos?email=${encodeURIComponent(seed.payer_email)}`);
      if (!response.ok && response.status !== 404) return reply({ error: "RykaPay indisponível. Tente novamente." }, 502);
      const legacy = response.ok ? normalizeStripeLegacy(record(record(await response.json()).dados).stripe, input.externalId) : [];
      if (!legacy) return reply({ error: "O RykaPay não conseguiu ler a Stripe agora. Tente novamente." }, 502);
      const paid = legacy.flatMap(s => s.invoices).filter(f => f.situation === "pago");
      if (!paid.length) return reply({ error: "Esta assinatura não tem pagamento aprovado." }, 409);
      paidOn = paid[0].paidAt?.slice(0, 10) ?? null;
    }
    const { error: decideError } = await db.rpc("decide_pay_link", {
      _request_id: input.requestId, _approve: true, _source: input.source, _external_id: input.externalId,
      _payer_name: payerName, _payer_document: input.payerDocument || null, _payer_email: input.payerEmail || null,
      _relationship: input.relationship, _relationship_other: input.relationshipOther || null,
      _amount_cents: amountCents, _paid_on: paidOn,
    });
    // RPC messages are written for the user (permission, already linked, missing relationship).
    if (decideError) return reply({ error: decideError.message || "Não foi possível vincular." }, 409);
    return reply({ ok: true });
  } catch {
    return reply({ error: "Não foi possível concluir. Tente novamente." }, 502);
  }
});
