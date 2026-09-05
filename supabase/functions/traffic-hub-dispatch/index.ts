import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_ATTEMPTS = 6;
const BATCH = 100;

type Delivery = {
  id: string;
  account_id: string;
  deal_id: string;
  attempts: number;
};

function backoffMinutes(attempts: number) {
  // 1, 5, 15, 60, 180, 360 minutos
  return [1, 5, 15, 60, 180, 360][Math.min(attempts, 5)];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body.action ?? "process");

  try {
    // ---- Reenviar histórico (requer admin autenticado) ----
    if (action === "backfill" || action === "test") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await admin.auth.getUser(token);
      const authUser = userData?.user;
      if (!authUser) return json({ error: "Não autenticado" }, 401);

      const { data: me } = await admin
        .from("users")
        .select("account_id, role, is_also_admin")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (!me || !(me.role === "admin" || me.role === "super_admin" || me.is_also_admin)) {
        return json({ error: "Apenas administradores" }, 403);
      }
      const accountId = me.account_id as string;

      const settings = await getSettings(admin, accountId);
      if (!settings) return json({ error: "Configure o endereço da Central antes." }, 400);

      if (action === "test") {
        const res = await postToHub(settings, {
          test: true,
          sent_at: new Date().toISOString(),
        });
        return json({ ok: res.ok, status: res.status, response: res.text.slice(0, 500) });
      }

      // Enfileira todas as vendas ganhas do histórico
      let from = 0;
      let queued = 0;
      while (true) {
        const { data: deals, error } = await admin
          .from("deals")
          .select("id")
          .eq("account_id", accountId)
          .eq("status", "won")
          .is("deleted_at", null)
          .range(from, from + 499);
        if (error) throw error;
        if (!deals?.length) break;

        const rows = deals.map((d) => ({
          account_id: accountId,
          deal_id: d.id,
          status: "pending",
          attempts: 0,
          next_attempt_at: new Date().toISOString(),
          last_error: null,
        }));
        const { error: upErr } = await admin
          .from("traffic_hub_deliveries")
          .upsert(rows, { onConflict: "deal_id" });
        if (upErr) throw upErr;
        queued += rows.length;
        if (deals.length < 500) break;
        from += 500;
      }

      const processed = await processQueue(admin);
      return json({ queued, ...processed });
    }

    // ---- Processamento da fila (trigger / cron) ----
    const result = await processQueue(admin);
    return json(result);
  } catch (e) {
    console.error("traffic-hub-dispatch error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function getSettings(admin: any, accountId: string) {
  const { data } = await admin
    .from("traffic_hub_settings")
    .select("endpoint_url, auth_token, is_active")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data?.endpoint_url || !data.is_active) return null;
  return data as { endpoint_url: string; auth_token: string | null; is_active: boolean };
}

async function postToHub(
  settings: { endpoint_url: string; auth_token: string | null },
  payload: unknown,
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.auth_token) {
    headers["Authorization"] = `Bearer ${settings.auth_token}`;
    headers["x-api-key"] = settings.auth_token;
  }
  const res = await fetch(settings.endpoint_url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

async function processQueue(admin: any) {
  const { data: pending, error } = await admin
    .from("traffic_hub_deliveries")
    .select("id, account_id, deal_id, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH);
  if (error) throw error;
  if (!pending?.length) return { sent: 0, failed: 0, pending: 0 };

  const deliveries = pending as Delivery[];
  const accountIds = [...new Set(deliveries.map((d) => d.account_id))];
  const settingsByAccount = new Map<string, any>();
  for (const acc of accountIds) {
    settingsByAccount.set(acc, await getSettings(admin, acc));
  }

  const dealIds = deliveries.map((d) => d.deal_id);
  const { data: deals } = await admin
    .from("deals")
    .select("id, account_id, title, contact_name, contact_email, contact_phone, value, won_at, created_at, updated_at")
    .in("id", dealIds);
  const dealById = new Map<string, any>((deals ?? []).map((d: any) => [d.id, d]));

  // Origem da venda (campo personalizado multi-select)
  const { data: originFields } = await admin
    .from("custom_fields")
    .select("id, options")
    .eq("name", "Origem da Venda")
    .eq("show_in_deals", true);
  const originFieldIds = (originFields ?? []).map((f: any) => f.id);
  const labelByValue = new Map<string, string>();
  for (const f of originFields ?? []) {
    for (const o of (f.options ?? []) as any[]) {
      if (o?.value) labelByValue.set(String(o.value), String(o.label ?? o.value));
    }
  }

  const originByDeal = new Map<string, string[]>();
  if (originFieldIds.length) {
    const { data: values } = await admin
      .from("deal_field_values")
      .select("deal_id, value_text, value_json")
      .in("deal_id", dealIds)
      .in("field_id", originFieldIds);
    for (const v of values ?? []) {
      const raw: string[] = Array.isArray(v.value_json)
        ? (v.value_json as any[]).map(String)
        : v.value_text
          ? [String(v.value_text)]
          : [];
      const labels = raw.map((r) => labelByValue.get(r) ?? r).filter(Boolean);
      if (labels.length) originByDeal.set(v.deal_id, labels);
    }
  }

  let sent = 0;
  let failed = 0;

  for (const d of deliveries) {
    const settings = settingsByAccount.get(d.account_id);
    const deal = dealById.get(d.deal_id);

    if (!settings) {
      failed++;
      continue; // sem endpoint configurado: fica pendente para quando configurar
    }
    if (!deal) {
      await admin
        .from("traffic_hub_deliveries")
        .update({ status: "failed", last_error: "Negócio não encontrado" })
        .eq("id", d.id);
      failed++;
      continue;
    }

    const origins = originByDeal.get(d.deal_id) ?? [];
    const payload = {
      event: "sale.won",
      source: "roy",
      sale_id: deal.id,
      external_id: deal.id,
      name: deal.contact_name ?? deal.title ?? null,
      email: deal.contact_email ?? null,
      phone: deal.contact_phone ?? null,
      value: deal.value != null ? Number(deal.value) : null,
      currency: "BRL",
      sold_at: deal.won_at ?? deal.updated_at ?? deal.created_at,
      origin: origins.join(" | ") || null,
      origin_values: origins,
      deal_title: deal.title ?? null,
    };

    try {
      const res = await postToHub(settings, payload);
      if (res.ok) {
        await admin
          .from("traffic_hub_deliveries")
          .update({
            status: "sent",
            attempts: d.attempts + 1,
            sent_at: new Date().toISOString(),
            last_status_code: res.status,
            last_error: null,
            payload,
          })
          .eq("id", d.id);
        sent++;
      } else {
        await markRetry(admin, d, `HTTP ${res.status}: ${res.text.slice(0, 300)}`, res.status, payload);
        failed++;
      }
    } catch (e) {
      await markRetry(admin, d, (e as Error).message, null, payload);
      failed++;
    }
  }

  return { sent, failed, processed: deliveries.length };
}

async function markRetry(
  admin: any,
  d: Delivery,
  error: string,
  statusCode: number | null,
  payload: unknown,
) {
  const attempts = d.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  const next = new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString();
  await admin
    .from("traffic_hub_deliveries")
    .update({
      status: exhausted ? "failed" : "pending",
      attempts,
      next_attempt_at: next,
      last_error: error,
      last_status_code: statusCode,
      payload,
    })
    .eq("id", d.id);
}
