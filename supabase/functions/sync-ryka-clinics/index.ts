// Sync de clientes do Clínica Ryka → preenche client_ryka_provisions com matches
// Espera que o projeto Ryka exponha um endpoint GET protegido por JWT do projeto + x-api-key:
//
//   GET <CLINICA_RYKA_LIST_URL>
//   Header: Authorization: Bearer <CLINICA_RYKA_AUTH_JWT ou anon key pública Ryka>
//   Header: apikey: <CLINICA_RYKA_AUTH_JWT ou anon key pública Ryka>
//   Header: x-api-key: <CLINICA_RYKA_API_KEY>
//   Resposta: { clients: [{ id, name, email, phone, is_active?, created_at? }, ...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canonicalEmail } from "../_shared/email-normalize.ts";
import { phoneCoreKey } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const RYKA_PUBLIC_ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjcWF6cGRxdmRraXJieHV5bXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NDQ4MTEsImV4cCI6MjA4NTQyMDgxMX0.tiMIUsvR93Rr8M5UdZQjPjZEfYzgFhPrlXHA-D7KM5o";

function rykaHeaders(apiKey: string, authJwt: string) {
  // O gateway do projeto Ryka exige um JWT válido no Authorization; a função
  // exposta valida a integração com x-api-key separadamente.
  const clean = apiKey.replace(/^Bearer\s+/i, "").trim();
  const cleanJwt = authJwt.replace(/^Bearer\s+/i, "").trim();
  return {
    Accept: "application/json",
    Authorization: `Bearer ${cleanJwt}`,
    apikey: cleanJwt,
    "x-api-key": clean,
  };
}

function listClientsUrl(url: string) {
  const u = new URL(url);
  if (!u.searchParams.has("action")) u.searchParams.set("action", "list_clients");
  return u.toString();
}

async function fetchRykaWithRedirects(url: string, headers: Record<string, string>) {
  let currentUrl = url;
  for (let i = 0; i < 5; i += 1) {
    const response = await fetch(currentUrl, {
      method: "GET",
      headers,
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    response.body?.cancel();
    if (!location) return response;
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error("Ryka redirecionou muitas vezes");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const LIST_URL = Deno.env.get("CLINICA_RYKA_LIST_URL");
  const API_KEY = Deno.env.get("CLINICA_RYKA_API_KEY");
  const RYKA_AUTH_JWT = Deno.env.get("CLINICA_RYKA_AUTH_JWT") || RYKA_PUBLIC_ANON_JWT;

  if (!LIST_URL || !API_KEY) {
    return jsonResp({ error: "Integração Ryka não configurada (CLINICA_RYKA_LIST_URL/API_KEY)" }, 500);
  }

  // Auth do chamador
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Não autorizado" }, 401);
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: authErr } = await callerClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authErr || !claims?.claims) return jsonResp({ error: "Token inválido" }, 401);
  const authUserId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: userRow } = await admin
    .from("users")
    .select("id, account_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!userRow?.account_id) return jsonResp({ error: "Usuário sem conta vinculada" }, 403);

  // 1) Buscar lista de clínicas no Ryka
  let rykaList: any[] = [];
  try {
    const rykaUrl = listClientsUrl(LIST_URL);
    const r = await fetchRykaWithRedirects(rykaUrl, rykaHeaders(API_KEY, RYKA_AUTH_JWT));
    const txt = await r.text();
    if (!r.ok) {
      console.error("[sync-ryka-clinics] Ryka request failed", {
        status: r.status,
        url: rykaUrl,
        hasAuthorization: true,
        hasXApiKey: true,
        body: txt.slice(0, 300),
      });
      return jsonResp({ error: `Ryka ${r.status}: ${txt.slice(0, 300)}` }, 502);
    }
    let parsed: any = null;
    try { parsed = JSON.parse(txt); } catch { return jsonResp({ error: "Resposta Ryka não é JSON", raw: txt.slice(0, 300) }, 502); }
    rykaList = Array.isArray(parsed?.clients) ? parsed.clients : Array.isArray(parsed?.clinics) ? parsed.clinics : Array.isArray(parsed) ? parsed : [];
  } catch (e: any) {
    return jsonResp({ error: `Falha ao chamar Ryka: ${e?.message || e}` }, 502);
  }

  // 2) Indexar clínicas Ryka por email canônico e por core-key de telefone
  const byEmail = new Map<string, any>();
  const byPhone = new Map<string, any>();
  for (const c of rykaList) {
    const e = canonicalEmail(c?.email);
    if (e) byEmail.set(e, c);
    const k = phoneCoreKey(c?.phone);
    if (k) byPhone.set(k, c);
  }

  // 3) Buscar clientes elegíveis (Rykas Mentoring / Eternum Club) da conta
  const { data: clients, error: clErr } = await admin
    .from("clients")
    .select("id, account_id, full_name, emails, phone_e164, client_products(products(name))")
    .eq("account_id", userRow.account_id);
  if (clErr) return jsonResp({ error: clErr.message }, 500);

  const ELIGIBLE = ["rykas mentoring", "eternum club"];
  const eligible = (clients || []).filter((c: any) =>
    (c.client_products || []).some((cp: any) => ELIGIBLE.includes(String(cp?.products?.name || "").toLowerCase()))
  );

  // 4) Provisões já existentes (para não duplicar)
  const clientIds = eligible.map((c: any) => c.id);
  const existingByClient = new Map<string, any>();
  if (clientIds.length) {
    const { data: provs } = await admin
      .from("client_ryka_provisions")
      .select("id, client_id, status, ryka_response, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false });
    for (const p of provs || []) {
      if (!existingByClient.has(p.client_id)) existingByClient.set(p.client_id, p);
    }
  }

  // 5) Match + upsert
  const toInsert: any[] = [];
  const toUpdate: { id: string; payload: any }[] = [];
  const matched: any[] = [];
  const unmatched: any[] = [];

  for (const c of eligible) {
    const emails = Array.isArray(c.emails) ? c.emails : (c.emails ? [c.emails] : []);
    let rykaMatch: any = null;
    let matchedBy: string | null = null;
    for (const e of emails) {
      const ce = canonicalEmail(e);
      if (ce && byEmail.has(ce)) { rykaMatch = byEmail.get(ce); matchedBy = "email"; break; }
    }
    if (!rykaMatch) {
      const k = phoneCoreKey(c.phone_e164);
      if (k && byPhone.has(k)) { rykaMatch = byPhone.get(k); matchedBy = "phone"; }
    }
    if (!rykaMatch) { unmatched.push({ client_id: c.id, name: c.full_name }); continue; }

    const rykaClinicId = rykaMatch.clinic_id ?? rykaMatch.id ?? null;
    const rykaStatus = rykaMatch.status ?? (typeof rykaMatch.is_active === "boolean" ? (rykaMatch.is_active ? "active" : "inactive") : null);

    matched.push({ client_id: c.id, name: c.full_name, clinic_id: rykaClinicId, matched_by: matchedBy });
    const responseEmail = rykaMatch.email || (emails[0] ?? null);
    const responsePhone = rykaMatch.phone || c.phone_e164 || null;

    const payload = {
      account_id: c.account_id,
      client_id: c.id,
      email: responseEmail,
      phone: responsePhone,
      status: "success",
      error: null,
      whatsapp_status: null,
      whatsapp_error: null,
      ryka_response: {
        source: "sync-ryka-clinics",
        matched_by: matchedBy,
        clinic_id: rykaClinicId,
        ryka_status: rykaStatus,
        last_login_at: rykaMatch.last_login_at ?? null,
        created_at: rykaMatch.created_at ?? null,
      },
      triggered_by: userRow.id,
    };

    const existing = existingByClient.get(c.id);
    if (existing && existing.status === "success") {
      // Atualiza ryka_response com dado mais fresco (não cria duplicata)
      toUpdate.push({ id: existing.id, payload: { ryka_response: payload.ryka_response, email: payload.email, phone: payload.phone } });
    } else {
      toInsert.push(payload);
    }
  }

  if (toInsert.length) {
    const { error: insErr } = await admin.from("client_ryka_provisions").insert(toInsert);
    if (insErr) return jsonResp({ error: `Insert falhou: ${insErr.message}` }, 500);
  }
  for (const u of toUpdate) {
    await admin.from("client_ryka_provisions").update(u.payload).eq("id", u.id);
  }

  return jsonResp({
    success: true,
    ryka_total: rykaList.length,
    eligible_total: eligible.length,
    matched_count: matched.length,
    inserted: toInsert.length,
    updated: toUpdate.length,
    unmatched_count: unmatched.length,
    matched,
    unmatched,
  });
});
