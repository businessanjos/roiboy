// @ts-nocheck
// Sincroniza o histórico de ligações da 3C Plus para `threecplus_call_logs`.
//
// A API da 3C Plus expõe o relatório completo (/api/v1/calls) apenas para tokens
// de administrador. Tokens de agente só acessam /api/v1/agent/calls (as próprias
// ligações). Por isso a sincronização roda por agente: cada agente cadastrado em
// `threecplus_agents` com `api_token` é sincronizado individualmente.
//
// Chamada pelo app (JWT) ou por cron (header x-cron-secret).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const MAX_PAGES_PER_AGENT = 20;
const PER_PAGE = 100;
const LEASE_MINUTES = 5;

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://app.3c.fluxoti.com";
  let base = String(domain).trim();
  base = base.replace(/\/login\/?$/, "");
  base = base.replace(/\/agent\/?.*$/, "");
  base = base.replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
}

function hmsToSeconds(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return Math.max(0, Math.round(v));
  const s = String(v).trim();
  const m = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function toIso(v: any): string | null {
  if (!v) return null;
  const raw = String(v).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? raw.replace(" ", "T") + "-03:00"
    : raw;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// A API exige "Y-m-d H:i:s" no fuso de Brasília
function fmtApiDateTime(d: Date, endOfDay = false): string {
  const br = new Date(d.getTime() - 3 * 3600_000);
  const day = br.toISOString().slice(0, 10);
  return `${day} ${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function normalizeStatus(call: any): string {
  const readable = String(call?.readable_status_text || "").toLowerCase();
  const speaking = hmsToSeconds(call?.speaking_time);
  if (speaking > 0) return "finished";
  if (/n[aã]o atendida|nao atendida/.test(readable)) return "unanswered";
  if (/abandon/.test(readable)) return "abandoned";
  if (/ocupad|falha|congest|erro/.test(readable)) return "failed";
  if (/atendida|finaliz/.test(readable)) return "finished";
  return readable || "unanswered";
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchAgentCallsPage(
  baseDomain: string,
  apiToken: string,
  start: string,
  end: string,
  page: number,
) {
  const url =
    `${baseDomain}/api/v1/agent/calls?start_date=${encodeURIComponent(start)}` +
    `&end_date=${encodeURIComponent(end)}&page=${page}&per_page=${PER_PAGE}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, items: [], hasMore: false, body: text };

  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 500, items: [], hasMore: false, body: "Resposta inválida" };
  }
  const items: any[] = Array.isArray(parsed?.data) ? parsed.data : [];
  const meta = parsed?.meta || {};
  const lastPage = Number(meta?.last_page ?? meta?.total_pages ?? NaN);
  const hasMore = Number.isFinite(lastPage) ? page < lastPage : items.length === PER_PAGE;
  return { ok: true, status: res.status, items, hasMore };
}

// Relatório global (somente token de administrador)
async function fetchAdminCallsPage(
  baseDomain: string,
  apiToken: string,
  start: string,
  end: string,
  page: number,
) {
  const url =
    `${baseDomain}/api/v1/calls?start_date=${encodeURIComponent(start)}` +
    `&end_date=${encodeURIComponent(end)}&page=${page}&per_page=${PER_PAGE}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, items: [], hasMore: false, body: text };
  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 500, items: [], hasMore: false, body: "Resposta inválida" };
  }
  const items: any[] = Array.isArray(parsed?.data)
    ? parsed.data
    : Array.isArray(parsed?.data?.data)
    ? parsed.data.data
    : [];
  const meta = parsed?.meta || parsed?.data || {};
  const lastPage = Number(meta?.last_page ?? meta?.total_pages ?? NaN);
  const hasMore = Number.isFinite(lastPage) ? page < lastPage : items.length === PER_PAGE;
  return { ok: true, status: res.status, items, hasMore };
}

async function fetchMe(baseDomain: string, apiToken: string) {

  const res = await fetch(`${baseDomain}/api/v1/me`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.data ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const payload = await req.json().catch(() => ({}));
    const cronSecret = req.headers.get("x-cron-secret");
    let isCron = !!cronSecret && cronSecret === Deno.env.get("THREECPLUS_CRON_SECRET");
    if (cronSecret && !isCron) {
      const { data: tokenRow } = await supabaseAdmin
        .from("internal_cron_tokens")
        .select("token")
        .eq("name", "threecplus_sync")
        .maybeSingle();
      isCron = !!tokenRow?.token && tokenRow.token === cronSecret;
    }

    let accountId: string | null = payload?.account_id ?? null;

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
      const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      const authUserId = claimsData?.claims?.sub;
      if (claimsError || !authUserId) return json({ error: "Não autorizado" }, 401);

      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id, account_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (!userData) return json({ error: "Usuário não encontrado" }, 404);
      accountId = userData.account_id;
    }

    if (!accountId) {
      const { data: integrations } = await supabaseAdmin
        .from("integrations")
        .select("account_id")
        .eq("type", "3cplus")
        .eq("status", "connected");
      const results: any[] = [];
      for (const it of integrations || []) {
        results.push({ account_id: it.account_id, ...(await syncAccount(supabaseAdmin, it.account_id, payload)) });
      }
      return json({ success: true, results });
    }

    const result = await syncAccount(supabaseAdmin, accountId, payload);
    return json({ success: !result.error, ...result });
  } catch (err) {
    console.error("[threecplus-sync-calls] fatal:", err);
    return json({ success: false, error: String(err?.message || err) });
  }
});

async function syncAccount(supabaseAdmin: any, accountId: string, payload: any) {
  const now = new Date();
  const force = payload?.force === true;

  const { data: state } = await supabaseAdmin
    .from("threecplus_sync_state")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (state?.is_paused && !force) {
    return { error: state.last_error || "Sincronização pausada", paused: true, synced: 0 };
  }
  if (state?.lease_until && new Date(state.lease_until) > now && !force) {
    return { error: "Sincronização já em andamento", synced: 0 };
  }

  await supabaseAdmin.from("threecplus_sync_state").upsert(
    {
      account_id: accountId,
      lease_until: new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString(),
      last_run_at: now.toISOString(),
      status: "running",
    },
    { onConflict: "account_id" },
  );

  const finish = async (patch: Record<string, unknown>) => {
    await supabaseAdmin
      .from("threecplus_sync_state")
      .update({ lease_until: null, ...patch })
      .eq("account_id", accountId);
  };

  try {
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("config")
      .eq("account_id", accountId)
      .eq("type", "3cplus")
      .eq("status", "connected")
      .maybeSingle();

    const adminToken: string | null =
      typeof integration?.config?.admin_api_token === "string" && integration.config.admin_api_token.trim()
        ? integration.config.admin_api_token.trim()
        : null;

    if (!integration?.config?.api_token && !adminToken) {
      await finish({ status: "error", last_error: "Integração 3C Plus não configurada" });
      return { error: "Integração 3C Plus não configurada", synced: 0 };
    }
    const baseDomain = getBaseDomain(integration.config.domain || null);

    // Semeia o agente dono do token da conta, se ainda não existir
    if (integration.config.api_token) {
      await seedAccountAgent(supabaseAdmin, accountId, baseDomain, integration.config.api_token);
    }

    const { data: agents } = await supabaseAdmin
      .from("threecplus_agents")
      .select("id, external_agent_id, external_name, external_email, user_id, api_token, is_tracked")
      .eq("account_id", accountId);

    const withToken = (agents || []).filter((a: any) => a.is_tracked && a.api_token);
    if (withToken.length === 0 && !adminToken) {
      await finish({
        status: "error",
        last_error:
          "Nenhum agente com token da 3C Plus cadastrado. Cadastre o token de administrador ou o token de API de cada agente.",
      });
      return {
        error:
          "Nenhum agente com token da 3C Plus cadastrado. Cadastre o token de administrador ou o token de API de cada agente.",
        synced: 0,
      };
    }


    // Janela de busca
    const days = Math.min(Math.max(Number(payload?.days) || 0, 0), 365);
    let start: Date;
    if (days > 0) start = new Date(now.getTime() - days * 86400_000);
    else if (state?.last_synced_at) start = new Date(new Date(state.last_synced_at).getTime() - 2 * 86400_000);
    else start = new Date(now.getTime() - 60 * 86400_000);

    const startStr = fmtApiDateTime(start);
    const endStr = fmtApiDateTime(now, true);

    // Usuários do ROY para casar agentes ainda não vinculados
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("account_id", accountId);
    const byEmail = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const u of users || []) {
      if (u.email) byEmail.set(String(u.email).toLowerCase(), u.id);
      if (u.name) byName.set(stripAccents(String(u.name)), u.id);
    }
    const matchUser = (email: string | null, name: string | null): string | null => {
      if (email && byEmail.has(email.toLowerCase())) return byEmail.get(email.toLowerCase())!;
      if (!name) return null;
      const n = stripAccents(name);
      if (byName.has(n)) return byName.get(n)!;
      const first = n.split(/\s+/)[0];
      if (first && first.length >= 4) {
        for (const [full, id] of byName) if (full.split(/\s+/)[0] === first) return id;
      }
      return null;
    };

    let totalSynced = 0;
    const perAgent: any[] = [];
    const errors: string[] = [];
    let maxStarted: string | null = null;

    for (const agent of withToken) {
      let userId = agent.user_id ?? matchUser(agent.external_email, agent.external_name);
      const rows: any[] = [];
      let page = 1;
      let agentError: string | null = null;

      while (page <= MAX_PAGES_PER_AGENT) {
        const res = await fetchAgentCallsPage(baseDomain, agent.api_token, startStr, endStr, page);
        if (!res.ok) {
          agentError =
            res.status === 401 || res.status === 403
              ? "Token inválido ou sem permissão"
              : `Erro na API (status ${res.status})`;
          break;
        }
        for (const call of res.items) {
          const callId = call?.id || call?.telephony_id;
          if (!callId) continue;
          const startedAt = toIso(call?.call_date_rfc3339 || call?.call_date || call?.created_at);
          if (startedAt && (!maxStarted || startedAt > maxStarted)) maxStarted = startedAt;
          const speaking = hmsToSeconds(call?.speaking_time);
          const isInbound = !!call?.receptive_did || String(call?.mode || "") === "receptive";

          rows.push({
            account_id: accountId,
            user_id: userId,
            call_id: String(callId),
            call_type: String(call?.mode || "dialer"),
            direction: isInbound ? "inbound" : "outbound",
            phone: call?.number ? String(call.number) : null,
            contact_name: call?.receptive_name || null,
            campaign_id: call?.campaign_id != null ? String(call.campaign_id) : null,
            campaign_name: call?.campaign || null,
            status: normalizeStatus(call),
            qualification: call?.qualification_id != null ? String(call.qualification_id) : null,
            qualification_name: call?.qualification || null,
            duration_seconds: speaking,
            acw_seconds: hmsToSeconds(call?.acw_time),
            wait_seconds: hmsToSeconds(call?.waiting_time),
            started_at: startedAt,
            connected_at: speaking > 0 ? startedAt : null,
            ended_at: toIso(call?.updated_at),
            agent_external_id: call?.agent_id != null ? String(call.agent_id) : String(agent.external_agent_id),
            agent_name: call?.agent || agent.external_name,
            agent_email: agent.external_email,
            metadata: {
              source: "api_sync",
              telephony_id: call?.telephony_id ?? null,
              recording: call?.recording ?? null,
              readable_status_text: call?.readable_status_text ?? null,
              billed_time: call?.billed_time ?? null,
            },
          });
        }
        if (!res.hasMore) break;
        page++;
      }

      let agentSynced = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await supabaseAdmin
          .from("threecplus_call_logs")
          .upsert(chunk, { onConflict: "account_id,call_id" });
        if (error) {
          agentError = error.message;
          break;
        }
        agentSynced += chunk.length;
      }

      totalSynced += agentSynced;
      if (agentError) errors.push(`${agent.external_name || agent.external_agent_id}: ${agentError}`);

      await supabaseAdmin
        .from("threecplus_agents")
        .update({
          user_id: userId,
          token_status: agentError ? "invalid" : "ok",
          last_synced_at: agentError ? undefined : now.toISOString(),
        })
        .eq("id", agent.id);

      perAgent.push({
        agent: agent.external_name || agent.external_agent_id,
        synced: agentSynced,
        error: agentError,
      });
    }

    await finish({
      status: errors.length ? "partial" : "ok",
      last_error: errors.length ? errors.join(" | ") : null,
      is_paused: false,
      calls_synced: totalSynced,
      last_synced_at: maxStarted || now.toISOString(),
    });

    return { synced: totalSynced, agents: perAgent, from: startStr, to: endStr };
  } catch (err) {
    console.error("[threecplus-sync-calls] error:", err);
    await finish({ status: "error", last_error: String(err?.message || err) });
    return { error: String(err?.message || err), synced: 0 };
  }
}

async function seedAccountAgent(
  supabaseAdmin: any,
  accountId: string,
  baseDomain: string,
  apiToken: string,
) {
  const me = await fetchMe(baseDomain, apiToken);
  if (!me?.id) return;
  const externalId = String(me.id);
  const { data: existing } = await supabaseAdmin
    .from("threecplus_agents")
    .select("id, api_token")
    .eq("account_id", accountId)
    .eq("external_agent_id", externalId)
    .maybeSingle();

  if (existing) {
    if (!existing.api_token) {
      await supabaseAdmin
        .from("threecplus_agents")
        .update({ api_token: apiToken, token_status: "ok" })
        .eq("id", existing.id);
    }
    return;
  }

  await supabaseAdmin.from("threecplus_agents").insert({
    account_id: accountId,
    external_agent_id: externalId,
    external_name: me.name ?? null,
    external_email: me.email ?? null,
    api_token: apiToken,
    token_status: "ok",
  });
}
