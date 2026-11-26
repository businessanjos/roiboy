import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { documentNumbers, matchesPayProduct, normalizePaySubscription, normalizeAnnualSale, activePaySubscription, record, type PayResult, type PaySubscription } from "../_shared/rykaPay.ts";

const BASE = "https://rykapay.app/api/public/v1";
// One company's credential must never become a cross-account lookup service.
const ROY_ACCOUNT = "796e7970-fd93-4574-a871-6090624cace6";
const Input = z.object({ dealId: z.string().uuid().optional(), clientId: z.string().uuid().optional() }).strict()
  .refine(v => Boolean(v.dealId) !== Boolean(v.clientId));
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  const auth = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!auth?.startsWith("Bearer ") || !url || !anon) return reply({ error: "Entre no ROY para consultar." }, 401);
  const db = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: claims, error: authError } = await db.auth.getClaims(auth.slice(7));
  if (authError || !claims?.claims?.sub) return reply({ error: "Sessão inválida." }, 401);
  const { data: me, error: meError } = await db.from("users").select("account_id,is_active").eq("auth_user_id", claims.claims.sub).maybeSingle();
  if (meError || !me || me.is_active === false || me.account_id !== ROY_ACCOUNT) return reply({ error: "Integração indisponível para esta conta." }, 403);
  const key = Deno.env.get("RYKAPAY_API_KEY");
  if (!key) return reply({ error: "Chave RykaPay não configurada." }, 503);

  try {
    const parsed = Input.safeParse(await req.json());
    if (!parsed.success) return reply({ error: "Informe um negócio ou cliente válido." }, 400);
    const { dealId, clientId } = parsed.data;
    let product: { id: string; name: string; color?: string | null } | null = null;
    let linkedClientId = clientId;
    let linkedLeadId: string | null = null;
    if (dealId) {
      const { data: deal, error } = await db.from("deals").select("id,client_id,lead_id").eq("id", dealId).eq("account_id", me.account_id).is("deleted_at", null).maybeSingle();
      if (error || !deal) return reply({ error: "Negócio não disponível para você." }, 404);
      linkedClientId = deal.client_id || undefined;
      linkedLeadId = deal.lead_id;
      const { data: field, error: fieldError } = await db.from("deal_field_values").select("value_text").eq("deal_id", dealId).eq("field_id", "033b91fb-3add-4c96-aec9-567fefbd0fb2").maybeSingle();
      if (fieldError) throw new Error("roy_read_failed");
      if (field?.value_text) {
        const value = field.value_text;
        if (z.string().uuid().safeParse(value).success) {
          const { data, error } = await db.from("products").select("id,name,color").eq("id", value).eq("account_id", me.account_id).maybeSingle();
          if (error) throw new Error("roy_read_failed");
          product = data;
        } else {
          const { data: custom, error } = await db.from("custom_fields").select("options").eq("id", "033b91fb-3add-4c96-aec9-567fefbd0fb2").eq("account_id", me.account_id).maybeSingle();
          if (error) throw new Error("roy_read_failed");
          const option = Array.isArray(custom?.options) ? custom.options.map(record).find(o => o.value === value) : null;
          if (typeof option?.label === "string") {
            const { data, error } = await db.from("products").select("id,name,color").eq("name", option.label).eq("account_id", me.account_id);
            if (error) throw new Error("roy_read_failed");
            if (data?.length === 1) product = data[0];
          }
        }
      }
    }
    const empty = (state: PayResult["state"]): PayResult => ({ state, subscriptions: [], partial: false, generatedAt: new Date().toISOString(), productName: product?.name ?? null });
    if (dealId && !product) return reply(empty("needs_product"));
    const docs = new Set<string>();
    if (linkedClientId) {
      const { data, error } = await db.from("clients").select("cpf,cnpj").eq("id", linkedClientId).eq("account_id", me.account_id).maybeSingle();
      if (error || !data) return reply({ error: "Cliente não disponível para você." }, 404);
      for (const v of [data.cpf, data.cnpj]) { const doc = documentNumbers(v); if (doc) docs.add(doc); }
    }
    if (!docs.size && linkedLeadId) {
      const { data, error } = await db.from("leads").select("cpf,cnpj").eq("id", linkedLeadId).eq("account_id", me.account_id).maybeSingle();
      if (error || !data) return reply({ error: "Lead não disponível para você." }, 404);
      for (const v of [data.cpf, data.cnpj]) { const doc = documentNumbers(v); if (doc) docs.add(doc); }
    }
    if (!docs.size) return reply(empty("needs_document"));
    let partial = false;
    const subscriptions = new Map<string, PaySubscription>();
    for (const documento of docs) {
      const endpoint = new URL(`${BASE}/clientes/pagamentos`);
      endpoint.searchParams.set("documento", documento);
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000), redirect: "error" });
      // Never return/log the raw body: it contains payer identities and provider tokens.
      if (response.status === 404) {
        const payload = await response.json().catch(() => null);
        if (record(payload).codigo === "cliente_nao_encontrado") continue;
      }
      if (!response.ok) return reply({ error: response.status === 401 ? "RykaPay recusou a consulta: confira a chave ou o limite de consultas." : response.status === 403 ? "A chave RykaPay não permite esta consulta." : "RykaPay indisponível. Tente novamente.", providerStatus: response.status }, 502);
      const payload = record(await response.json());
      const data = record(payload.dados);
      if (!Array.isArray(data.assinaturas) || !Array.isArray(data.cobrancas_avulsas) || typeof data.parcial !== "boolean") throw new Error("invalid_pay_response");
      partial ||= data.parcial;
      for (const raw of data.assinaturas) {
        const sub = normalizePaySubscription(raw);
        if (activePaySubscription(sub.status) && (!product || matchesPayProduct(sub, product))) subscriptions.set(sub.id, sub);
      }
      for (const raw of data.cobrancas_avulsas) {
        const sub = normalizeAnnualSale(raw);
        if (sub && (!product || matchesPayProduct(sub, product))) subscriptions.set(sub.id, sub);
      }
    }
    const { data: royProducts, error: productsError } = await db.from("products").select("id,name,color").eq("account_id", me.account_id);
    if (productsError) throw new Error("roy_read_failed");
    const presented = [...subscriptions.values()].map(sub => {
      const matched = product || royProducts?.find(p => matchesPayProduct(sub, p));
      return { ...sub, royProductColor: matched?.color && /^#[0-9a-f]{6}$/i.test(matched.color) ? matched.color : null };
    });
    return reply({ ...empty(subscriptions.size ? "ready" : "not_found"), subscriptions: presented, partial });
  } catch {
    return reply({ error: "Não foi possível validar a consulta de assinaturas. Tente novamente." }, 502);
  }
});