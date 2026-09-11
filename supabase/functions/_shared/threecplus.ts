// @ts-nocheck
// Helpers compartilhados da integração 3C Plus.
// A partir de 2026 a 3C exige o header `X-Agent-Id` em toda requisição feita
// com token de agente. Guardamos o id do agente por token e injetamos o header
// automaticamente em `fetch3c`.

const AGENT_ID_BY_TOKEN = new Map<string, string>();

export const AGENT_ID_REQUIRED_MESSAGE =
  "A 3C Plus exige o ID do agente. Abra Configurações > Integrações > 3C Plus > Meu Ramal e salve o ramal novamente para atualizar seu cadastro.";

export function registerAgentId(token: unknown, agentId: unknown) {
  if (typeof token !== "string" || !token.trim()) return;
  if (agentId === null || agentId === undefined) return;
  const id = String(agentId).trim();
  if (!id) return;
  AGENT_ID_BY_TOKEN.set(token.trim(), id);
}

export function agentIdForToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  return AGENT_ID_BY_TOKEN.get(token.trim()) ?? null;
}

function tokenFromRequest(url: string, init?: RequestInit): string | null {
  const fromQuery = /[?&]api_token=([^&]+)/.exec(url);
  if (fromQuery) return decodeURIComponent(fromQuery[1]);

  const headers = (init?.headers ?? {}) as Record<string, string>;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization" && typeof value === "string") {
      return value.replace(/^Bearer\s+/i, "").trim();
    }
  }
  return null;
}

/**
 * fetch para a 3C Plus:
 * - sempre envia o token no header `Authorization: Bearer` (nunca na query string);
 * - injeta `X-Agent-Id` quando conhecemos o agente daquele token/contexto.
 */
export async function fetch3c(url: string, init?: RequestInit): Promise<Response> {
  const token = tokenFromRequest(url, init);
  const agentId = contextAgentId() ?? agentIdForToken(token);

  // move api_token da query para o header Authorization
  let finalUrl = url;
  const headers: Record<string, string> = { ...((init?.headers ?? {}) as Record<string, string>) };
  if (/[?&]api_token=/.test(url)) {
    finalUrl = url.replace(/([?&])api_token=[^&]*&?/, "$1").replace(/[?&]$/, "");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (agentId) headers["X-Agent-Id"] = agentId;

  return fetch(finalUrl, { ...init, headers });
}

export type ThreeCAgentStatus = "offline" | "idle" | "on_call" | "break" | "manual" | "unknown";

export type ThreeCAgentRuntime = {
  logged_campaign: boolean;
  has_active_call: boolean;
  manual_mode: boolean;
  agent_status: string | null;
  normalized_status: ThreeCAgentStatus;
  agent_http_status: number | null;
  campaign_http_status: number | null;
  webphone_registered: boolean;
  campaign_id: string | null;
  campaign_name: string | null;
  manual_campaign: boolean;
};

async function runtimeProofKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createThreeCRuntimeProof(agentId: string, runtime: ThreeCAgentRuntime) {
  const payload = JSON.stringify({ agent_id: agentId, polled_at: new Date().toISOString(), runtime });
  const signature = await crypto.subtle.sign("HMAC", await runtimeProofKey(), new TextEncoder().encode(payload));
  return `${btoa(payload)}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

export async function verifyThreeCRuntimeProof(proof: unknown, expectedAgentId: string | null) {
  if (typeof proof !== "string" || !expectedAgentId) return null;
  const [payloadPart, signaturePart] = proof.split(".");
  if (!payloadPart || !signaturePart) return null;
  try {
    const payload = atob(payloadPart);
    const signature = Uint8Array.from(atob(signaturePart), (char) => char.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", await runtimeProofKey(), signature, new TextEncoder().encode(payload));
    if (!valid) return null;
    const parsed = JSON.parse(payload);
    if (String(parsed.agent_id || "") !== expectedAgentId) return null;
    const age = Date.now() - new Date(parsed.polled_at).getTime();
    if (!Number.isFinite(age) || age < 0 || age > 20_000) return null;
    return parsed.runtime as ThreeCAgentRuntime;
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function findStructuredAgentState(value: unknown, depth = 0): string | null {
  if (depth > 5) return null;
  const record = asObject(value);
  if (!record) return null;
  for (const key of ["status", "agent_status", "agentStatus", "state", "mode"]) {
    const field = record[key];
    if (typeof field === "string" && field.trim()) return field.trim().toLowerCase();
  }
  for (const key of ["data", "agent"]) {
    const nested = findStructuredAgentState(record[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function hasStructuredCall(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  const record = asObject(value);
  if (!record) return false;
  const call = asObject(record.call);
  if (call && (call.id != null || call.call_id != null || call.phone != null || call.number != null)) return true;
  if (record.call_id != null) return true;
  return hasStructuredCall(record.data, depth + 1) || hasStructuredCall(record.agent, depth + 1);
}

function findStructuredBoolean(value: unknown, keys: string[], depth = 0): boolean | null {
  if (depth > 5) return null;
  const record = asObject(value);
  if (!record) return null;
  for (const key of keys) {
    const field = record[key];
    if (typeof field === "boolean") return field;
    if (typeof field === "number") return field !== 0;
    if (typeof field === "string") {
      const normalized = field.trim().toLowerCase();
      if (["true", "1", "yes", "sim", "registered", "connected", "online"].includes(normalized)) return true;
      if (["false", "0", "no", "nao", "não", "unregistered", "disconnected", "offline"].includes(normalized)) return false;
    }
  }
  for (const key of ["data", "agent", "extension", "webrtc", "webphone"]) {
    const nested = findStructuredBoolean(record[key], keys, depth + 1);
    if (nested !== null) return nested;
  }
  return null;
}

function normalizeStructuredAgentState(raw: string | null, hasActiveCall: boolean): ThreeCAgentStatus {
  if (hasActiveCall) return "on_call";
  if (!raw) return "unknown";
  const value = raw.replaceAll("-", "_").replaceAll(" ", "_");
  const exact: Record<string, ThreeCAgentStatus> = {
    idle: "idle", ocioso: "idle", available: "idle", disponivel: "idle", disponível: "idle", ready: "idle",
    on_call: "on_call", in_call: "on_call", talking: "on_call", em_chamada: "on_call", dialing: "on_call",
    manual: "manual", manual_call: "manual", manual_mode: "manual",
    break: "break", pause: "break", pausa: "break", intervalo: "break", acw: "break", tpa: "break",
    offline: "offline", logged_out: "offline", disconnected: "offline", desconectado: "offline",
  };
  return exact[value] ?? "unknown";
}

function parseJsonBody(text: string): unknown {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { non_json_body: text.slice(0, 1000) }; }
}

/** Fonte única do estado do agente para chamadas, painel e tabela administrativa. */
export async function fetchThreeCAgentRuntime(baseDomain: string, apiToken: string): Promise<ThreeCAgentRuntime> {
  const runtime: ThreeCAgentRuntime = {
    logged_campaign: false,
    has_active_call: false,
    manual_mode: false,
    agent_status: null,
    normalized_status: "offline",
    agent_http_status: null,
    campaign_http_status: null,
    webphone_registered: false,
    campaign_id: null,
    campaign_name: null,
    manual_campaign: false,
  };

  let agentOk = false;
  try {
    const response = await fetch3c(`${getBaseDomain(baseDomain)}/api/v1/agent?api_token=${apiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const text = await response.text();
    const payload = parseJsonBody(text);
    runtime.agent_http_status = response.status;
    agentOk = response.ok;
    console.log("[threecplus-runtime] GET /api/v1/agent raw:", JSON.stringify({ status: response.status, json: payload }));
    runtime.agent_status = findStructuredAgentState(payload);
    runtime.has_active_call = hasStructuredCall(payload);
    runtime.webphone_registered = findStructuredBoolean(payload, [
      "webphone", "webphone_registered", "web_phone", "webrtc_registered", "extension_registered", "registered",
    ]) ?? false;
    runtime.normalized_status = response.ok
      ? normalizeStructuredAgentState(runtime.agent_status, runtime.has_active_call)
      : "offline";
    runtime.manual_mode = runtime.normalized_status === "manual";
  } catch (error) {
    console.error("[threecplus-runtime] GET /api/v1/agent failed:", error);
  }

  for (const path of ["/api/v1/campaigns/agent/loggedCampaign", "/api/v1/agent/loggedCampaign"]) {
    try {
      const response = await fetch3c(`${getBaseDomain(baseDomain)}${path}?api_token=${apiToken}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      runtime.campaign_http_status = response.status;
      console.log("[threecplus-runtime] GET logged campaign:", JSON.stringify({ path, status: response.status }));
      if (response.ok) {
        runtime.logged_campaign = true;
        const campaign = asObject(payload);
        const campaignData = asObject(campaign?.data) ?? campaign;
        runtime.campaign_id = campaignData?.id != null ? String(campaignData.id) : null;
        runtime.campaign_name = typeof campaignData?.name === "string"
          ? campaignData.name
          : typeof campaignData?.campaign === "string" ? campaignData.campaign : null;
        runtime.manual_campaign = /manual|prospec[cç][aã]o/i.test(runtime.campaign_name ?? "");
        break;
      }
      if (response.status !== 404) break;
    } catch (error) {
      console.error(`[threecplus-runtime] GET ${path} failed:`, error);
      break;
    }
  }

  if (runtime.logged_campaign && (runtime.normalized_status === "unknown" || (!agentOk && !runtime.agent_status))) {
    runtime.normalized_status = "idle";
  } else if (runtime.normalized_status === "unknown") {
    runtime.normalized_status = "offline";
  }
  return runtime;
}

/** Complementa a leitura com a rota oficial de Gestor quando /agent não está disponível. */
export async function fetchThreeCAgentRuntimeForUser(
  baseDomain: string,
  apiToken: string,
  options?: { managerToken?: string | null; agentId?: string | null },
): Promise<ThreeCAgentRuntime> {
  const runtime = await fetchThreeCAgentRuntime(baseDomain, apiToken);
  const managerToken = options?.managerToken ?? contextManagerToken();
  const agentId = options?.agentId ?? contextAgentId();
  if (!managerToken || !agentId || runtime.agent_http_status === 200) return runtime;

  try {
    const response = await fetch(`${getBaseDomain(baseDomain)}/api/v1/agents/status`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${managerToken}` },
    });
    const text = await response.text();
    const payload = parseJsonBody(text);
    console.log("[threecplus-runtime] GET /api/v1/agents/status raw:", JSON.stringify({ status: response.status, json: payload }));
    if (!response.ok) return runtime;

    const root = asObject(payload);
    const candidates = Array.isArray(payload)
      ? payload
      : Array.isArray(root?.data) ? root.data : root ? [root] : [];
    const row = candidates.find((item) => {
      const record = asObject(item);
      return record?.id != null && String(record.id) === String(agentId);
    });
    if (!row) return runtime;

    runtime.agent_http_status = response.status;
    runtime.agent_status = findStructuredAgentState(row);
    runtime.has_active_call = hasStructuredCall(row);
    runtime.normalized_status = normalizeStructuredAgentState(runtime.agent_status, runtime.has_active_call);
    runtime.manual_mode = runtime.normalized_status === "manual";
    if (runtime.normalized_status === "unknown" && runtime.logged_campaign) runtime.normalized_status = "idle";
    return runtime;
  } catch (error) {
    console.error("[threecplus-runtime] GET /api/v1/agents/status failed:", error);
    return runtime;
  }
}

/** Detecta erros da 3C que reclamam do header X-Agent-Id. */
export function mentionsAgentIdHeader(...parts: Array<unknown>): boolean {
  return parts.some((part) => typeof part === "string" && /x-?agent-?id/i.test(part));
}

/** Traduz o status devolvido pela 3C para uma mensagem clara no ROY. */
export function threeCErrorMessage(status: number, body?: string): string {
  if (status === 400) {
    return "A 3C não reconheceu o agente desta ação (ID ausente ou inválido). Abra Integrações > 3C Plus e clique em \"Sincronizar agentes da 3C\".";
  }
  if (status === 401) {
    return "Token da 3C inválido ou revogado. Gere um novo em Config. > Integração > Tokens de serviço.";
  }
  if (status === 403) {
    return "O papel deste token da 3C não permite esta ação (use o token de Gestor para relatórios e o de Agente para ligações).";
  }
  return `A 3C respondeu com erro (status ${status}).${body ? ` ${String(body).slice(0, 160)}` : ""}`;
}


export function getBaseDomain(domain: string | null | undefined): string {
  if (!domain) return "https://eternumentoringclub1.3c.plus";
  let base = String(domain).trim();
  base = base.replace(/\/login\/?$/, "").replace(/\/agent\/?.*$/, "").replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
}

/** Busca o id do agente na 3C usando o token (aceita header opcional já conhecido). */
export async function fetchAgentIdFromApi(
  baseDomain: string,
  apiToken: string,
  knownAgentId?: string | null,
): Promise<{ id: string | null; name: string | null; email: string | null; status: number; body: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${apiToken}`,
  };
  if (knownAgentId) headers["X-Agent-Id"] = String(knownAgentId);

  const res = await fetch(`${baseDomain}/api/v1/me`, { headers });
  const body = await res.text();
  if (!res.ok) return { id: null, name: null, email: null, status: res.status, body };

  let parsed: any = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  const me = parsed?.data ?? parsed;
  return {
    id: me?.id != null ? String(me.id) : null,
    name: me?.name ?? me?.full_name ?? null,
    email: me?.email ?? null,
    status: res.status,
    body,
  };
}

/**
 * Resolve o id do agente do usuário: metadata > threecplus_agents > API /me.
 * Registra o id no cache de tokens para que `fetch3c` envie o header.
 */
export async function resolveUserAgentId(
  supabaseAdmin: any,
  opts: {
    userId: string;
    accountId: string;
    apiToken: string;
    baseDomain: string;
    metadata?: Record<string, unknown> | null;
  },
): Promise<string | null> {
  const { userId, accountId, apiToken, baseDomain, metadata } = opts;

  const fromMetadata = metadata?.agent_id;
  if (fromMetadata) {
    const id = String(fromMetadata).trim();
    if (id) {
      registerAgentId(apiToken, id);
      return id;
    }
  }

  const { data: agentRow } = await supabaseAdmin
    .from("threecplus_agents")
    .select("external_agent_id")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (agentRow?.external_agent_id) {
    const id = String(agentRow.external_agent_id);
    registerAgentId(apiToken, id);
    return id;
  }

  const profile = await fetchAgentIdFromApi(baseDomain, apiToken);
  if (profile.id) {
    registerAgentId(apiToken, profile.id);
    await supabaseAdmin.from("threecplus_agents").upsert(
      {
        account_id: accountId,
        external_agent_id: profile.id,
        external_name: profile.name,
        external_email: profile.email,
        api_token: apiToken,
        token_status: "ok",
        user_id: userId,
        is_tracked: true,
      },
      { onConflict: "account_id,external_agent_id" },
    );
    return profile.id;
  }

  return null;
}

/** Resolve o id do agente dono de um token de conta (sem usuário associado). */
export async function resolveAgentIdByToken(
  supabaseAdmin: any,
  accountId: string,
  apiToken: string,
  baseDomain: string,
): Promise<string | null> {
  const cached = agentIdForToken(apiToken);
  if (cached) return cached;

  const { data } = await supabaseAdmin
    .from("threecplus_agents")
    .select("external_agent_id")
    .eq("account_id", accountId)
    .eq("api_token", apiToken)
    .maybeSingle();

  if (data?.external_agent_id) {
    registerAgentId(apiToken, data.external_agent_id);
    return String(data.external_agent_id);
  }

  const profile = await fetchAgentIdFromApi(baseDomain, apiToken);
  if (profile.id) {
    registerAgentId(apiToken, profile.id);
    return profile.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Modelo novo (2026): token de serviço único da conta + header X-Agent-Id
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from "node:async_hooks";

const AGENT_CONTEXT = new AsyncLocalStorage<{ agentId: string | null; managerToken: string | null }>();

/** Envolve o handler da edge function para isolar o agente daquela requisição. */
export function with3cContext<T>(fn: () => Promise<T> | T): Promise<T> | T {
  return AGENT_CONTEXT.run({ agentId: null, managerToken: null }, fn as () => T);
}

export function setContextAgentId(agentId: unknown) {
  const store = AGENT_CONTEXT.getStore();
  if (!store) return;
  store.agentId = agentId === null || agentId === undefined ? null : String(agentId).trim() || null;
}

export function contextAgentId(): string | null {
  return AGENT_CONTEXT.getStore()?.agentId ?? null;
}

export function setContextManagerToken(token: unknown) {
  const store = AGENT_CONTEXT.getStore();
  if (!store) return;
  store.managerToken = typeof token === "string" && token.trim() ? token.trim() : null;
}

export function contextManagerToken(): string | null {
  return AGENT_CONTEXT.getStore()?.managerToken ?? null;
}

export const SERVICE_TOKEN_MISSING_AGENT_MESSAGE =
  "Não encontramos o seu agente na 3C Plus. Abra Configurações > Integrações > 3C Plus > Meu Ramal, confira o ramal e salve novamente.";

export type ThreeCConfig = Record<string, unknown>;

/** Lê a integração da conta (config completo, nunca devolvido ao browser). */
export function isServiceToken(value: unknown): boolean {
  return typeof value === "string" && value.trim().startsWith("3cs_");
}

function pickToken(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export async function loadAccountIntegration(
  supabaseAdmin: any,
  accountId: string,
): Promise<{
  id: string | null;
  config: ThreeCConfig;
  baseDomain: string;
  serviceToken: string | null;
  agentServiceToken: string | null;
  managerServiceToken: string | null;
  accountToken: string | null;
}> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("id, config")
    .eq("account_id", accountId)
    .eq("type", "3cplus")
    .maybeSingle();

  const config = (data?.config as ThreeCConfig) || {};

  // Token de papel AGENTE (click2call, manual_call, webphone, /agent/*)
  const agentServiceToken = pickToken(
    config.service_token_agent,
    isServiceToken(config.service_token) ? config.service_token : null,
  );

  // Token de papel GESTOR (listar agentes/usuários, relatório global /api/v1/calls)
  const managerServiceToken = pickToken(
    config.service_token_manager,
    isServiceToken(config.admin_api_token) ? config.admin_api_token : null,
  );

  const accountToken = typeof config.api_token === "string" && config.api_token.trim()
    ? config.api_token.trim()
    : null;

  return {
    id: data?.id ?? null,
    config,
    baseDomain: getBaseDomain((config.domain as string) || null),
    serviceToken: agentServiceToken ?? managerServiceToken,
    agentServiceToken,
    managerServiceToken,
    accountToken,
  };
}

/** Lista agentes/usuários da 3C usando o token de papel Gestor. */
export async function listThreeCAgents(
  baseDomain: string,
  managerToken: string,
): Promise<Array<{ id: string; name: string | null; email: string | null; extension: string | null; active: boolean }>> {
  const out: Array<{ id: string; name: string | null; email: string | null; extension: string | null; active: boolean }> = [];
  const seen = new Set<string>();

  for (const endpoint of ["/api/v1/agents", "/api/v1/users"]) {
    for (let page = 1; page <= 20; page++) {
      let res: Response;
      try {
        res = await fetch(`${baseDomain}${endpoint}?page=${page}&per_page=100`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${managerToken}` },
        });
      } catch {
        break;
      }
      if (!res.ok) break;

      let parsed: any = null;
      try {
        parsed = JSON.parse(await res.text());
      } catch {
        break;
      }

      const rows: any[] = Array.isArray(parsed) ? parsed : parsed?.data ?? [];
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const row of rows) {
        if (row?.id == null || seen.has(String(row.id))) continue;
        seen.add(String(row.id));
        const ext = row?.extension?.extension_number ?? row?.extension_number ?? row?.extension ?? null;
        out.push({
          id: String(row.id),
          name: row?.name ?? row?.full_name ?? null,
          email: row?.email ?? null,
          extension: ext != null ? String(ext).replace(/\D/g, "") : null,
          active: row?.active !== false && row?.status !== "inactive" && row?.is_active !== false,
        });
      }

      const lastPage = parsed?.last_page ?? parsed?.meta?.last_page ?? page;
      if (page >= Number(lastPage)) break;
    }
    if (out.length) break;
  }

  return out;
}


/** Busca o agente na 3C pela lista de usuários, casando por ramal, e-mail ou nome. */
export async function findAgentByExtensionOrEmail(
  baseDomain: string,
  serviceToken: string,
  match: { extension?: string | null; email?: string | null; name?: string | null },
): Promise<{ id: string; name: string | null; email: string | null; extension: string | null } | null> {
  const wantedExt = match.extension ? String(match.extension).replace(/\D/g, "") : null;
  const wantedEmail = match.email ? String(match.email).trim().toLowerCase() : null;
  const wantedName = match.name ? String(match.name).trim().toLowerCase() : null;

  const endpoints = ["/api/v1/users", "/api/v1/agents"];

  for (const endpoint of endpoints) {
    for (let page = 1; page <= 10; page++) {
      let res: Response;
      try {
        res = await fetch(`${baseDomain}${endpoint}?page=${page}&per_page=100`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${serviceToken}` },
        });
      } catch {
        break;
      }
      if (!res.ok) break;

      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        break;
      }

      const rows: any[] = Array.isArray(parsed) ? parsed : parsed?.data ?? [];
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const row of rows) {
        const ext = row?.extension?.extension_number ?? row?.extension_number ?? row?.extension ?? null;
        const extDigits = ext != null ? String(ext).replace(/\D/g, "") : null;
        const email = row?.email ? String(row.email).trim().toLowerCase() : null;
        const name = row?.name ? String(row.name).trim().toLowerCase() : null;

        const hit =
          (wantedExt && extDigits && extDigits === wantedExt) ||
          (wantedEmail && email && email === wantedEmail) ||
          (wantedName && name && name === wantedName);

        if (hit && row?.id != null) {
          return {
            id: String(row.id),
            name: row?.name ?? null,
            email: row?.email ?? null,
            extension: extDigits,
          };
        }
      }

      const lastPage = parsed?.last_page ?? parsed?.meta?.last_page ?? page;
      if (page >= Number(lastPage)) break;
    }
  }

  return null;
}

export type AgentAuth = {
  /** Token usado nas chamadas à 3C (serviço quando existir, senão individual/conta). */
  apiToken: string | null;
  agentId: string | null;
  usingServiceToken: boolean;
  baseDomain: string;
  serviceToken: string | null;
  managerServiceToken?: string | null;
  accountToken: string | null;
  extension: string | null;
  extensionPassword: string | null;
  personalToken: string | null;
  config: ThreeCConfig;
};

/**
 * Autenticação padrão da 3C para um usuário do ROY:
 * token de serviço + X-Agent-Id, com fallback para o token individual do agente.
 */
export async function resolveAgentAuth(
  supabaseAdmin: any,
  opts: { userId: string; accountId: string; userEmail?: string | null; userName?: string | null },
): Promise<AgentAuth> {
  const account = await loadAccountIntegration(supabaseAdmin, opts.accountId);

  const { data: userInt } = await supabaseAdmin
    .from("user_integrations")
    .select("access_token, metadata")
    .eq("user_id", opts.userId)
    .eq("provider", "3cplus")
    .maybeSingle();

  const metadata = (userInt?.metadata as Record<string, unknown>) || {};
  const rawPersonal = typeof userInt?.access_token === "string" ? userInt.access_token.trim() : "";
  const personalToken = rawPersonal && rawPersonal !== "account_level" ? rawPersonal : null;
  const extension = metadata.extension ? String(metadata.extension) : null;
  const extensionPassword = metadata.extension_password ? String(metadata.extension_password) : null;

  let agentId = metadata.agent_id ? String(metadata.agent_id).trim() : null;

  if (!agentId) {
    const { data: agentRow } = await supabaseAdmin
      .from("threecplus_agents")
      .select("external_agent_id")
      .eq("account_id", opts.accountId)
      .eq("user_id", opts.userId)
      .maybeSingle();
    if (agentRow?.external_agent_id) agentId = String(agentRow.external_agent_id);
  }

  if (!agentId && account.managerServiceToken) {
    const found = await findAgentByExtensionOrEmail(account.baseDomain, account.managerServiceToken, {
      extension,
      email: opts.userEmail ?? null,
      name: opts.userName ?? null,
    });
    if (found) agentId = found.id;
  }

  if (!agentId && personalToken) {
    const profile = await fetchAgentIdFromApi(account.baseDomain, personalToken);
    if (profile.id) agentId = profile.id;
  }

  if (agentId) {
    setContextAgentId(agentId);
    registerAgentId(account.agentServiceToken, agentId);
    registerAgentId(personalToken, agentId);
  }

  // Ações de agente usam o token de papel Agente (sempre com X-Agent-Id).
  const apiToken = (agentId ? account.agentServiceToken : null) ?? personalToken ?? account.agentServiceToken ?? account.accountToken;

  return {
    apiToken,
    agentId,
    usingServiceToken: Boolean(account.agentServiceToken && agentId),
    baseDomain: account.baseDomain,
    serviceToken: account.agentServiceToken,
    managerServiceToken: account.managerServiceToken,
    accountToken: account.accountToken,
    extension,
    extensionPassword,
    personalToken,
    config: account.config,
  };
}


/** Grava o vínculo do usuário com o agente da 3C nas duas tabelas. */
export async function persistAgentLink(
  supabaseAdmin: any,
  opts: {
    accountId: string;
    userId: string;
    agentId: string;
    name?: string | null;
    email?: string | null;
    apiToken?: string | null;
    extension?: string | null;
    extensionPassword?: string | null;
  },
) {
  await supabaseAdmin.from("threecplus_agents").upsert(
    {
      account_id: opts.accountId,
      external_agent_id: String(opts.agentId),
      external_name: opts.name ?? null,
      external_email: opts.email ?? null,
      ...(opts.apiToken ? { api_token: opts.apiToken } : {}),
      token_status: "ok",
      user_id: opts.userId,
      is_tracked: true,
    },
    { onConflict: "account_id,external_agent_id" },
  );

  const { data: existing } = await supabaseAdmin
    .from("user_integrations")
    .select("id, metadata")
    .eq("user_id", opts.userId)
    .eq("provider", "3cplus")
    .maybeSingle();

  const metadata = {
    ...((existing?.metadata as Record<string, unknown>) || {}),
    agent_id: String(opts.agentId),
    ...(opts.extension !== undefined ? { extension: opts.extension } : {}),
    ...(opts.extensionPassword !== undefined ? { extension_password: opts.extensionPassword } : {}),
  };

  if (existing?.id) {
    await supabaseAdmin
      .from("user_integrations")
      .update({ metadata, ...(opts.apiToken ? { access_token: opts.apiToken } : {}) })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("user_integrations").insert({
      user_id: opts.userId,
      provider: "3cplus",
      access_token: opts.apiToken ?? "account_level",
      metadata,
    });
  }
}
