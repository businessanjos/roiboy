import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IntegrationData = {
  apiToken: string;
  baseDomain: string;
};

function getValidUserApiToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "account_level") return null;
  return trimmed;
}

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://app.3c.fluxoti.com";
  let base = domain.trim();
  base = base.replace(/\/login\/?$/, "");
  base = base.replace(/\/agent\/?.*$/, "");
  base = base.replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractApiMessage(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text);
    return parsed?.detail || parsed?.title || parsed?.message || fallback;
  } catch {
    return text?.trim() || fallback;
  }
}

function safeJsonParse(text: string): unknown | null {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function parseBooleanish(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "sim", "registered", "connected", "online"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "nao", "não", "unregistered", "disconnected", "offline"].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizePhone(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function extractCallDetails(value: unknown): { id?: string | number; phone?: string; contact_name?: string } | null {
  const record = asRecord(value);
  if (!record) return null;

  const callRecord = asRecord(record.call) ?? record;
  const mailing = asRecord(record.mailing);
  const mailingData = asRecord(mailing?.data);

  const id = callRecord.id ?? callRecord.call_id ?? record.call_id;
  const phone =
    normalizePhone(callRecord.phone) ||
    normalizePhone(callRecord.number) ||
    normalizePhone(record.phone) ||
    normalizePhone(record.number) ||
    normalizePhone(mailingData?.phone);
  const contact_name =
    (typeof callRecord.contact_name === "string" && callRecord.contact_name) ||
    (typeof record.contact_name === "string" && record.contact_name) ||
    (typeof mailingData?.name === "string" && mailingData.name) ||
    (typeof mailingData?.Nome === "string" && mailingData.Nome) ||
    undefined;

  if (!id && !phone && !contact_name) return null;
  return {
    ...(id ? { id: id as string | number } : {}),
    ...(phone ? { phone } : {}),
    ...(contact_name ? { contact_name } : {}),
  };
}

function extractWebphoneRegistered(value: unknown, depth = 0): boolean | null {
  if (!value || depth > 4) return null;
  const record = asRecord(value);
  if (!record) return null;

  const directKeys = [
    "webphone",
    "webphone_registered",
    "web_phone",
    "webrtc_registered",
    "extension_registered",
    "registered",
  ];

  for (const key of directKeys) {
    const parsed = parseBooleanish(record[key]);
    if (parsed !== null) return parsed;
  }

  const nestedKeys = ["data", "agent", "extension", "webrtc", "webphone"];
  for (const key of nestedKeys) {
    const nested = extractWebphoneRegistered(record[key], depth + 1);
    if (nested !== null) return nested;
  }

  return null;
}

function getWebphoneNotReadyMessage() {
  return "O ramal WebRTC abriu, mas ainda não foi registrado na 3C Plus. Aguarde alguns segundos e tente novamente.";
}

function extractAgentStatus(value: unknown, depth = 0): string | null {
  if (!value || depth > 4) return null;
  const record = asRecord(value);
  if (!record) return null;

  const directKeys = ["status", "state", "agent_status", "agentStatus", "mode"];
  for (const key of directKeys) {
    const currentValue = record[key];
    if (typeof currentValue === "string" && currentValue.trim()) {
      return currentValue.trim().toLowerCase();
    }
  }

  const nestedKeys = ["data", "agent", "call"];
  for (const key of nestedKeys) {
    const nestedStatus = extractAgentStatus(record[key], depth + 1);
    if (nestedStatus) return nestedStatus;
  }

  return null;
}

async function fetchAgentRuntimeState(apiBase: string, apiToken: string) {
  const runtime = {
    logged_campaign: false,
    has_active_call: false,
    manual_mode: false,
    call_id: null as string | number | null,
    agent_status: null as string | null,
    webphone_registered: false,
  };

  try {
    const agentRes = await fetch(`${apiBase}/agent?api_token=${apiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const agentText = await agentRes.text();

    if (agentRes.ok) {
      const agentPayload = safeJsonParse(agentText);
      const callDetails = extractCallDetails(agentPayload);
      const agentStatus = extractAgentStatus(agentPayload);
      const webphoneRegistered = extractWebphoneRegistered(agentPayload);

      runtime.has_active_call = Boolean(callDetails?.id || callDetails?.phone);
      runtime.call_id = callDetails?.id ?? null;
      runtime.agent_status = agentStatus;
      runtime.manual_mode = Boolean(agentStatus && /manual/i.test(agentStatus));
      runtime.webphone_registered = webphoneRegistered ?? false;
    }
  } catch (error) {
    console.error("[threecplus-agent] fetchAgentRuntimeState agent error:", error);
  }

  try {
    const campaignRes = await fetch(`${apiBase}/campaigns/agent/loggedCampaign?api_token=${apiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    runtime.logged_campaign = campaignRes.ok;
  } catch (error) {
    console.error("[threecplus-agent] fetchAgentRuntimeState campaign error:", error);
  }

  return runtime;
}

async function waitForWebphoneRegistration(apiBase: string, apiToken: string, timeoutMs = 12000) {
  const startedAt = Date.now();
  let runtime = await fetchAgentRuntimeState(apiBase, apiToken);

  while (Date.now() - startedAt < timeoutMs) {
    if (runtime.webphone_registered) {
      return { success: true, runtime };
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
    runtime = await fetchAgentRuntimeState(apiBase, apiToken);
  }

  return { success: Boolean(runtime.webphone_registered), runtime };
}

function isManualModeAlreadyActive(status: number, text: string): boolean {
  if (status !== 422) return false;
  const message = extractApiMessage(text, "");
  return /modo manual|manual_call|j[áa]\s+est[áa].*manual|j[áa]\s+est[áa].*disc/i.test(message);
}

function isAgentNotIdle(status: number, text: string): boolean {
  if (status !== 422) return false;
  const message = extractApiMessage(text, "");
  return /n[ãa]o\s+est[áa]\s+ocioso/i.test(message);
}

function isPermissionDenied(status: number, text: string): boolean {
  if (status !== 403) return false;
  const message = extractApiMessage(text, "");
  return /sem permiss|n[ãa]o tem permiss|proibido/i.test(message);
}

function normalizeCampaignId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isDialReadyRuntime(runtime: {
  logged_campaign?: boolean;
  has_active_call?: boolean;
  manual_mode?: boolean;
  agent_status?: string | null;
} | null | undefined): boolean {
  if (!runtime?.logged_campaign || runtime.has_active_call) return false;

  const status = runtime.agent_status?.toLowerCase() ?? "";
  if (!status) return !runtime.manual_mode;
  if (/idle|ocioso/.test(status)) return true;
  if (/manual|call|chamada|talk|acw|tpa|break|intervalo|pause|pausa|ocupado/.test(status)) return false;
  return !runtime.manual_mode;
}

async function fetchAvailableAgentCampaigns(apiBase: string, apiToken: string) {
  const response = await fetch(`${apiBase}/agent/campaigns?api_token=${apiToken}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await response.text();

  if (!response.ok) {
    return { success: false, campaigns: [] as Array<Record<string, unknown>>, error: extractApiMessage(text, "Falha ao listar campanhas do agente.") };
  }

  const payload = safeJsonParse(text) as Record<string, unknown> | Array<Record<string, unknown>> | null;
  const rawCampaigns = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown> | null)?.data)
      ? ((payload as Record<string, unknown>).data as Array<Record<string, unknown>>)
      : [];

  return { success: true, campaigns: rawCampaigns, error: null };
}

function pickAgentCampaign(campaigns: Array<Record<string, unknown>>, preferredCampaignId?: unknown) {
  const normalizedPreferred = normalizeCampaignId(preferredCampaignId);
  if (normalizedPreferred) {
    const preferred = campaigns.find((campaign) => normalizeCampaignId(campaign.id) === normalizedPreferred);
    if (preferred) return preferred;
  }

  return campaigns[0] ?? null;
}

async function connectAgentSession(apiBase: string, apiToken: string) {
  try {
    const connectRes = await fetch(`${apiBase}/agent/connect?api_token=${apiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });
    const connectText = await connectRes.text();
    console.log("[threecplus-agent] connectAgentSession agent/connect:", connectRes.status, connectText);
    return connectRes.ok || connectRes.status === 204;
  } catch (error) {
    console.warn("[threecplus-agent] connectAgentSession failed:", error);
    return false;
  }
}

async function postToAgentEndpoint(
  apiBase: string,
  apiToken: string,
  path: string,
  body?: Record<string, unknown>,
) {
  return fetch(`${apiBase}${path}?api_token=${apiToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function fetchLoggedCampaignState(apiBase: string, apiToken: string) {
  try {
    const response = await fetch(`${apiBase}/campaigns/agent/loggedCampaign?api_token=${apiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const text = await response.text();

    return {
      success: response.ok,
      campaign: response.ok ? safeJsonParse(text) : null,
    };
  } catch (error) {
    console.warn("[threecplus-agent] fetchLoggedCampaignState failed:", error);
    return { success: false, campaign: null };
  }
}

async function cleanupAgentState(apiBase: string, apiToken: string) {
  const actions = [
    { label: "manual_call/exit", path: "/agent/manual_call/exit" },
    { label: "logout", path: "/agent/logout" },
  ];

  for (const action of actions) {
    try {
      const response = await postToAgentEndpoint(apiBase, apiToken, action.path);
      const text = await response.text();
      console.log(`[threecplus-agent] cleanup ${action.label}:`, response.status, text);
    } catch (error) {
      console.warn(`[threecplus-agent] cleanup ${action.label} failed:`, error);
    }
  }

  return fetchAgentRuntimeState(apiBase, apiToken);
}

async function tryClick2Call(
  apiBase: string,
  apiToken: string,
  phone: string,
  extension?: string | null,
  password?: string | null,
) {
  const payload: Record<string, string> = { phone };
  if (extension) payload.extension = extension;
  if (password) payload.password = password;

  const response = await postToAgentEndpoint(apiBase, apiToken, "/click2call", payload);
  const text = await response.text();
  console.log("[threecplus-agent] click2call:", response.status, text);

  return {
    success: response.ok || response.status === 204,
    status: response.status,
    text,
    call: extractCallDetails(safeJsonParse(text)) || { phone },
  };
}

async function loginWebphoneSession(apiBase: string, apiToken: string, preferredCampaignId?: unknown) {
  const campaignsResult = await fetchAvailableAgentCampaigns(apiBase, apiToken);
  if (!campaignsResult.success) {
    return { success: false, error: campaignsResult.error };
  }

  const campaign = pickAgentCampaign(campaignsResult.campaigns, preferredCampaignId);
  const campaignId = normalizeCampaignId(campaign?.id);
  if (!campaignId) {
    return { success: false, error: "Nenhuma campanha disponível para este agente no 3C Plus." };
  }

  const webphoneRes = await fetch(`${apiBase}/agent/webphone/login?api_token=${apiToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ campaign: campaignId }),
  });
  const webphoneText = await webphoneRes.text();
  console.log("[threecplus-agent] loginWebphoneSession agent/webphone/login:", webphoneRes.status, webphoneText);

  if (webphoneRes.ok || webphoneRes.status === 204) {
    await connectAgentSession(apiBase, apiToken);
    return { success: true, error: null };
  }

  return {
    success: false,
    error: extractApiMessage(webphoneText, "A 3C Plus não confirmou o login do WebRTC para este agente."),
  };
}

async function waitForAgentReady(apiBase: string, apiToken: string, timeoutMs = 12000) {
  const startedAt = Date.now();
  let runtime = await fetchAgentRuntimeState(apiBase, apiToken);

  while (Date.now() - startedAt < timeoutMs) {
    if (isDialReadyRuntime(runtime)) {
      return { success: true, runtime };
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
    runtime = await fetchAgentRuntimeState(apiBase, apiToken);
  }

  return { success: isDialReadyRuntime(runtime), runtime };
}

async function ensureAgentReadyForDial(
  apiBase: string,
  apiToken: string,
  preferredCampaignId?: unknown,
) {
  const webphoneResult = await waitForWebphoneRegistration(apiBase, apiToken, 12000);
  let runtime = webphoneResult.runtime;
  let performedCampaignLogin = false;

  if (!webphoneResult.success) {
    return {
      success: false,
      runtime,
      error: getWebphoneNotReadyMessage(),
    };
  }

  if (runtime.manual_mode && !runtime.has_active_call) {
    try {
      const exitRes = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] ensureAgentReadyForDial manual_call_exit:", exitRes.status, await exitRes.text());
    } catch (error) {
      console.warn("[threecplus-agent] ensureAgentReadyForDial manual_call_exit failed:", error);
    }

    runtime = await fetchAgentRuntimeState(apiBase, apiToken);
  }

  if (isDialReadyRuntime(runtime)) {
    return { success: true, runtime, method: "already_ready" };
  }

  if (!runtime.logged_campaign) {
    const campaignsResult = await fetchAvailableAgentCampaigns(apiBase, apiToken);
    if (!campaignsResult.success) {
      return { success: false, runtime, error: campaignsResult.error };
    }

    const campaign = pickAgentCampaign(campaignsResult.campaigns, preferredCampaignId);
    const campaignId = normalizeCampaignId(campaign?.id);
    if (!campaignId) {
      return { success: false, runtime, error: "Nenhuma campanha disponível para este agente no 3C Plus." };
    }

    const loginRes = await fetch(`${apiBase}/agent/login?api_token=${apiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ campaign: campaignId }),
    });
    const loginText = await loginRes.text();
    console.log("[threecplus-agent] ensureAgentReadyForDial agent/login:", loginRes.status, loginText);

    if (!(loginRes.ok || loginRes.status === 204)) {
      return {
        success: false,
        runtime,
        error: extractApiMessage(loginText, "A 3C Plus não conseguiu logar o agente em uma campanha."),
      };
    }

    performedCampaignLogin = true;
    runtime = { ...runtime, logged_campaign: true };
  }

  const readyResult = await waitForAgentReady(apiBase, apiToken, 8000);
  if (readyResult.success) {
    return { success: true, runtime: readyResult.runtime, method: "campaign_login" };
  }

  const latestRuntime = readyResult.runtime ?? await fetchAgentRuntimeState(apiBase, apiToken);

  const loggedCampaignState = await fetchLoggedCampaignState(apiBase, apiToken);
  const hasConfirmedCampaign = loggedCampaignState.success || latestRuntime.logged_campaign;

  if (hasConfirmedCampaign && !latestRuntime.has_active_call) {
    console.log("[threecplus-agent] ensureAgentReadyForDial: agent logged in campaign, proceeding despite status:", latestRuntime.agent_status);
    return {
      success: true,
      runtime: { ...latestRuntime, logged_campaign: true },
      method: performedCampaignLogin ? "campaign_login_confirmed" : "campaign_login_force",
    };
  }

  return {
    success: false,
    runtime: { ...latestRuntime, logged_campaign: hasConfirmedCampaign },
    error: performedCampaignLogin
      ? "A 3C Plus aceitou o login da campanha, mas não abriu a sessão real do agente para discagem."
      : "O agente não está logado em uma campanha ativa no 3C Plus.",
  };
}

function normalizeExtension(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed;
}

function extractExtension(value: unknown, depth = 0): string | null {
  if (!value || depth > 4) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = extractExtension(item, depth + 1);
      if (match) return match;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  const directKeys = ["extension", "ramal", "agent_extension", "agentExtension", "extension_number", "extensionNumber", "voip_extension", "voipExtension"];
  for (const key of directKeys) {
    const match = normalizeExtension(record[key]);
    if (match) return match;
  }
  const nestedKeys = ["data", "user", "agent", "operator", "profile", "sip", "webrtc", "pbx"];
  for (const key of nestedKeys) {
    const match = extractExtension(record[key], depth + 1);
    if (match) return match;
  }
  return null;
}

async function fetchAgentProfile(baseDomain: string, apiToken: string) {
  const attempts = [
    { url: `${baseDomain}/api/v1/me`, init: { method: "GET", headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" } } },
    { url: `${baseDomain}/api/v1/me?api_token=${apiToken}`, init: { method: "GET", headers: { Accept: "application/json" } } },
  ];
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, attempt.init);
      const text = await response.text();
      if (!response.ok) continue;
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error("[threecplus-agent] fetchAgentProfile error:", error);
    }
  }
  return null;
}

async function resolveClick2CallExtension(
  supabaseAdmin: any, userId: string, baseDomain: string, apiToken: string
) {
  // Check user_integrations metadata for saved extension
  const { data: userInt } = await supabaseAdmin
    .from("user_integrations")
    .select("access_token, metadata")
    .eq("user_id", userId)
    .eq("provider", "3cplus")
    .maybeSingle();

  const metadata = asRecord(userInt?.metadata);
  const storedAccessToken = typeof userInt?.access_token === "string" ? userInt.access_token : null;
  const storedExtension = extractExtension(metadata);
  const storedPassword = metadata?.extension_password as string | null;
  if (storedExtension) return { extension: storedExtension, password: storedPassword, source: "metadata" };

  const profile = await fetchAgentProfile(baseDomain, apiToken);
  const profileExtension = extractExtension(profile);
  if (profileExtension) {
    // Save to user metadata for next time
    const nextMetadata = { ...(metadata ?? {}), extension: profileExtension };
    await supabaseAdmin
      .from("user_integrations")
      .upsert({ user_id: userId, provider: "3cplus", access_token: storedAccessToken ?? "account_level", metadata: nextMetadata }, { onConflict: "user_id,provider" });
    return { extension: profileExtension, password: null, source: "profile" };
  }
  return { extension: null, password: null, source: null };
}

/** Get 3C Plus config from account-level integrations table */
async function getAccountIntegration(supabaseAdmin: any, accountId: string): Promise<IntegrationData | null> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("account_id", accountId)
    .eq("type", "3cplus")
    .eq("status", "connected")
    .maybeSingle();

  if (!data?.config) return null;
  const config = data.config as Record<string, unknown>;
  const apiToken = config.api_token as string;
  const domain = config.domain as string | null;
  if (!apiToken) return null;

  return { apiToken, baseDomain: getBaseDomain(domain || null) };
}

/** Best-effort log a call to threecplus_call_logs */
async function logCallToDb(
  supabaseAdmin: any,
  accountId: string,
  userId: string,
  callDetails: { id?: string | number; phone?: string; contact_name?: string } | null,
  mode: string,
  campaignName?: string,
) {
  try {
    const callId = callDetails?.id ? String(callDetails.id) : `manual_${Date.now()}`;
    const { error } = await supabaseAdmin.from("threecplus_call_logs").insert({
      account_id: accountId,
      user_id: userId,
      call_id: callId,
      call_type: "manual",
      direction: "outbound",
      phone: callDetails?.phone || null,
      contact_name: callDetails?.contact_name || null,
      campaign_name: campaignName || null,
      status: "connected",
      started_at: new Date().toISOString(),
      metadata: { source: "edge_function", mode },
    });
    if (error) {
      console.error("[threecplus-agent] logCallToDb DB error:", JSON.stringify(error));
    } else {
      console.log("[threecplus-agent] logCallToDb: saved call", callId);
    }
  } catch (err) {
    console.error("[threecplus-agent] logCallToDb exception:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    const authUserId = claimsData?.claims?.sub;
    if (claimsError || !authUserId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, account_id")
      .eq("auth_user_id", authUserId)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Actions that don't need integration
    if (action === "save_extension") {
      const { extension: ext, extension_password: extPwd } = body;
      if (!ext) {
        return new Response(
          JSON.stringify({ success: false, error: "extension é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: existing } = await supabaseAdmin
        .from("user_integrations")
        .select("access_token, metadata")
        .eq("user_id", userData.id)
        .eq("provider", "3cplus")
        .maybeSingle();

      const prevMeta = asRecord(existing?.metadata) ?? {};
      const nextMetadata = { ...prevMeta, extension: String(ext).trim(), ...(extPwd ? { extension_password: String(extPwd).trim() } : {}) };
      const preservedAccessToken = getValidUserApiToken(existing?.access_token) ?? "account_level";

      await supabaseAdmin
        .from("user_integrations")
        .upsert(
          { user_id: userData.id, provider: "3cplus", access_token: preservedAccessToken, metadata: nextMetadata },
          { onConflict: "user_id,provider" }
        );

      return new Response(
        JSON.stringify({ success: true, extension: String(ext).trim() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_extension") {
      const { data: userInt } = await supabaseAdmin
        .from("user_integrations")
        .select("metadata")
        .eq("user_id", userData.id)
        .eq("provider", "3cplus")
        .maybeSingle();
      const metadata = asRecord(userInt?.metadata);
      const stored = extractExtension(metadata);
      const storedPassword = metadata?.extension_password as string | null;
      return new Response(
        JSON.stringify({ success: true, extension: stored, extension_password: storedPassword ? "••••" : null, has_password: Boolean(storedPassword) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All other actions need the account-level integration
    const integration = await getAccountIntegration(supabaseAdmin, userData.account_id);
    if (!integration) {
      return new Response(
        JSON.stringify({ success: false, code: "NO_INTEGRATION", error: "3C Plus não configurado. Peça ao administrador para configurar em Configurações > Integrações." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiToken, baseDomain } = integration;
    const apiBase = `${baseDomain}/api/v1`;
    const { data: userIntegration } = await supabaseAdmin
      .from("user_integrations")
      .select("access_token")
      .eq("user_id", userData.id)
      .eq("provider", "3cplus")
      .maybeSingle();
    const agentApiToken = getValidUserApiToken(userIntegration?.access_token);
    const effectiveApiToken = agentApiToken ?? apiToken;

    // Return connection info
    if (action === "get_connection_info") {
      return new Response(
        JSON.stringify({
          success: true,
          domain: baseDomain,
          api_token: effectiveApiToken,
          extension_url: `${baseDomain}/extension?api_token=${effectiveApiToken}`,
          socket_url: "https://socket.3c.plus",
          has_agent_token: Boolean(agentApiToken),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Login to campaign
    if (action === "login") {
      const { campaign_id } = body;
      if (!campaign_id) {
        return new Response(JSON.stringify({ success: false, error: "campaign_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const webphoneResult = await waitForWebphoneRegistration(apiBase, effectiveApiToken, 12000);
      if (!webphoneResult.success) {
        return new Response(JSON.stringify({
          success: false,
          code: "WEBPHONE_NOT_READY",
          error: getWebphoneNotReadyMessage(),
          runtime: webphoneResult.runtime,
        }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const res = await fetch(`${apiBase}/agent/login?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ campaign: campaign_id }),
      });
      const text = await res.text();
      console.log("[threecplus-agent] login:", res.status, text);
      if (res.ok || res.status === 204) {
        const runtime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
        return new Response(JSON.stringify({ success: true, message: "Login na campanha enviado", runtime }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: false, error: "Falha ao entrar na campanha", status: res.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_runtime") {
      const runtime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
      return new Response(JSON.stringify({ success: true, runtime }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Logout
    if (action === "logout") {
      const manualExitRes = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const manualExitText = await manualExitRes.text();
      console.log("[threecplus-agent] logout manual_call_exit:", manualExitRes.status, manualExitText);

      const res = await fetch(`${apiBase}/agent/logout?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] logout:", res.status, text);

      let runtime = null;
      let success = res.ok || res.status === 204;

      if (!success) {
        runtime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
        if (!runtime.logged_campaign) {
          success = true;
        }
      }

      const manualExitSuccess =
        manualExitRes.ok ||
        manualExitRes.status === 204 ||
        Boolean(runtime && !runtime.has_active_call);

      return new Response(
        JSON.stringify({
          success,
          manual_exit_success: manualExitSuccess,
          method: success && !(res.ok || res.status === 204) ? "already_logged_out" : "logout",
          runtime,
          error: success ? null : extractApiMessage(text, "Falha ao sair da campanha"),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enter manual call mode
    if (action === "manual_call_enter") {
      const res = await fetch(`${apiBase}/agent/manual_call/enter?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_enter:", res.status, text);
      if (res.ok || res.status === 204) {
        return new Response(JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let errorMessage = "Falha ao entrar no modo manual";
      try { const parsed = JSON.parse(text); errorMessage = parsed?.detail || parsed?.title || errorMessage; } catch {}
      return new Response(JSON.stringify({ success: false, error: errorMessage, status: res.status, detail: text }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dial number in manual mode
    if (action === "manual_call_dial") {
      const { phone } = body;
      if (!phone) {
        return new Response(JSON.stringify({ success: false, error: "phone é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await fetch(`${apiBase}/agent/manual_call/dial?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_dial:", res.status, text);
      const success = res.ok || res.status === 204;
      let errorMessage: string | null = null;
      if (!success) {
        errorMessage = "A 3C Plus recusou a chamada manual.";
        try { const parsed = JSON.parse(text); errorMessage = parsed?.detail || parsed?.title || parsed?.message || errorMessage; } catch { if (text?.trim()) errorMessage = text.trim(); }
      } else {
        const dialPayload = safeJsonParse(text);
        const callDetails = extractCallDetails(dialPayload) || { phone: cleanPhone };
        await logCallToDb(supabaseAdmin, userData.account_id, userData.id, callDetails, "manual_dial");
      }
      return new Response(JSON.stringify({ success, error: errorMessage, status: res.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Place a direct call
    if (action === "place_call") {
      const { phone, campaign_id } = body;
      if (!phone) {
        return new Response(JSON.stringify({ success: false, error: "phone é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanPhone = phone.replace(/\D/g, "");

      const { extension, password } = await resolveClick2CallExtension(supabaseAdmin, userData.id, baseDomain, effectiveApiToken);
      const click2CallFallbackToken = effectiveApiToken !== apiToken ? apiToken : null;
      const webphoneResult = await waitForWebphoneRegistration(apiBase, effectiveApiToken, 12000);

      if (!webphoneResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: getWebphoneNotReadyMessage(),
            code: "WEBPHONE_NOT_READY",
            extension_resolved: Boolean(extension),
            runtime: webphoneResult.runtime,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const connectRes = await fetch(`${apiBase}/agent/connect?api_token=${effectiveApiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        const connectText = await connectRes.text();
        console.log("[threecplus-agent] place_call agent/connect:", connectRes.status, connectText);
      } catch (connectErr) {
        console.warn("[threecplus-agent] place_call agent/connect failed (non-blocking):", connectErr);
      }

      const click2CallResult = await tryClick2Call(apiBase, effectiveApiToken, cleanPhone, extension, password);
      if (click2CallResult.success) {
        await logCallToDb(supabaseAdmin, userData.account_id, userData.id, click2CallResult.call, "click2call");
        return new Response(JSON.stringify({ success: true, mode: "click2call", call: click2CallResult.call }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (click2CallFallbackToken && isPermissionDenied(click2CallResult.status, click2CallResult.text)) {
        console.log("[threecplus-agent] place_call retrying click2call with account token after agent token permission denial");
        const fallbackClick2CallResult = await tryClick2Call(apiBase, click2CallFallbackToken, cleanPhone, extension, password);
        if (fallbackClick2CallResult.success) {
          await logCallToDb(supabaseAdmin, userData.account_id, userData.id, fallbackClick2CallResult.call, "click2call_account_token");
          return new Response(JSON.stringify({ success: true, mode: "click2call", call: fallbackClick2CallResult.call }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (extension && isAgentNotIdle(click2CallResult.status, click2CallResult.text)) {
        const webphoneResult = await loginWebphoneSession(apiBase, effectiveApiToken, campaign_id);
        if (webphoneResult.success) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const retryClick2CallResult = await tryClick2Call(apiBase, effectiveApiToken, cleanPhone, extension, password);
          if (retryClick2CallResult.success) {
            await logCallToDb(supabaseAdmin, userData.account_id, userData.id, retryClick2CallResult.call, "click2call_webphone_retry");
            return new Response(JSON.stringify({ success: true, mode: "click2call", call: retryClick2CallResult.call }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } else {
          console.warn("[threecplus-agent] place_call webphone login skipped/failed:", webphoneResult.error);
        }
      }

      await cleanupAgentState(apiBase, effectiveApiToken);
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const postCleanupClick2CallResult = await tryClick2Call(apiBase, effectiveApiToken, cleanPhone, extension, password);
      if (postCleanupClick2CallResult.success) {
        await logCallToDb(supabaseAdmin, userData.account_id, userData.id, postCleanupClick2CallResult.call, "click2call_after_cleanup");
        return new Response(JSON.stringify({ success: true, mode: "click2call", call: postCleanupClick2CallResult.call }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const readyResult = await ensureAgentReadyForDial(apiBase, effectiveApiToken, campaign_id);
      if (!readyResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: readyResult.error,
            code: "AGENT_NOT_READY",
            extension_resolved: Boolean(extension),
            runtime: readyResult.runtime,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const enterRes = await fetch(`${apiBase}/agent/manual_call/enter?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const enterText = await enterRes.text();
      console.log("[threecplus-agent] place_call manual_call_enter:", enterRes.status, enterText);

      const manualModeAlreadyActive = isManualModeAlreadyActive(enterRes.status, enterText);
      const agentNotIdle = isAgentNotIdle(enterRes.status, enterText);

      if (enterRes.ok || enterRes.status === 204 || manualModeAlreadyActive) {
        if (manualModeAlreadyActive) {
          console.log("[threecplus-agent] place_call proceeding to dial because agent is already in manual dialing state");
        }

        const dialPayload: Record<string, string> = { phone: cleanPhone };
        if (extension) dialPayload.extension = extension;
        if (password) dialPayload.password = password;

        const dialRes = await fetch(`${apiBase}/agent/manual_call/dial?api_token=${effectiveApiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(dialPayload),
        });
        const dialText = await dialRes.text();
        const dialPayloadResponse = safeJsonParse(dialText);
        const manualCall = extractCallDetails(dialPayloadResponse) || { phone: cleanPhone };
        console.log("[threecplus-agent] place_call manual_call_dial:", dialRes.status, dialText);

        if (dialRes.ok || dialRes.status === 204) {
          await logCallToDb(supabaseAdmin, userData.account_id, userData.id, manualCall, "manual_mode");
          return new Response(JSON.stringify({ success: true, mode: "manual_mode", call: manualCall }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: false, error: extractApiMessage(dialText, "A 3C Plus recusou a chamada manual."), status: dialRes.status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const latestRuntime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
      return new Response(
        JSON.stringify({
          success: false,
          error: agentNotIdle
            ? "O agente ainda não ficou ocioso no 3C Plus. Aguarde o carregamento completo do ramal WebRTC e tente novamente."
            : extractApiMessage(enterText, "Não foi possível iniciar a chamada manual."),
          extension_resolved: Boolean(extension),
          runtime: latestRuntime,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exit manual call mode
    if (action === "manual_call_exit") {
      const res = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_exit:", res.status, text);

      let runtime = null;
      let success = res.ok || res.status === 204;

      if (!success) {
        runtime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
        if (!runtime.has_active_call && !runtime.manual_mode) {
          success = true;
        }
      }

      return new Response(
        JSON.stringify({
          success,
          method: success && !(res.ok || res.status === 204) ? "already_exited_manual_mode" : "manual_call_exit",
          runtime,
          error: success ? null : extractApiMessage(text, "A 3C Plus não confirmou a saída do modo manual."),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hangup call
    if (action === "hangup") {
      const { call_id } = body;

      let runtime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
      let resolvedCallId = call_id ?? runtime.call_id ?? undefined;

      if (!resolvedCallId && !runtime.has_active_call) {
        return new Response(
          JSON.stringify({ success: true, method: "already_hung_up", runtime }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!resolvedCallId) {
        console.log("[threecplus-agent] hangup: trying manual_call/exit fallback");
        const exitRes = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${effectiveApiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        const exitText = await exitRes.text();
        console.log("[threecplus-agent] manual_call/exit fallback:", exitRes.status, exitText);

        runtime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
        const exitSuccess = exitRes.ok || exitRes.status === 204 || !runtime.has_active_call;
        if (exitSuccess) {
          return new Response(
            JSON.stringify({ success: true, method: "manual_exit_fallback", runtime }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("[threecplus-agent] hangup: trying logout as last resort");
        const logoutRes = await fetch(`${apiBase}/agent/logout?api_token=${effectiveApiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        const logoutText = await logoutRes.text();
        console.log("[threecplus-agent] logout fallback:", logoutRes.status, logoutText);

        runtime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
        const success = logoutRes.ok || logoutRes.status === 204 || !runtime.has_active_call;
        return new Response(
          JSON.stringify({
            success,
            method: success ? "already_hung_up" : "logout_fallback",
            runtime,
            error: success ? null : extractApiMessage(logoutText, "A 3C Plus não confirmou o encerramento da chamada."),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${apiBase}/agent/call/${resolvedCallId}/hangup?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] hangup:", res.status, text);

      let success = res.ok || res.status === 204;
      let manualExitSucceeded = false;

      if (!success) {
        console.log("[threecplus-agent] hangup failed, trying manual_call/exit fallback after call_id attempt");
        const exitRes = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${effectiveApiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        const exitText = await exitRes.text();
        console.log("[threecplus-agent] post-hangup manual_call_exit fallback:", exitRes.status, exitText);
        manualExitSucceeded = exitRes.ok || exitRes.status === 204;
      }

      runtime = await fetchAgentRuntimeState(apiBase, effectiveApiToken);
      if (!success && (manualExitSucceeded || !runtime.has_active_call)) {
        success = true;
      }

      // Update call log with ended_at and duration
      if (success) {
        try {
          const endedAt = new Date().toISOString();
          
          // Find the call log: first try exact call_id, then fallback to most recent for this user
          let logToUpdate: { id: string; started_at: string | null } | null = null;
          
          if (resolvedCallId) {
            const { data } = await supabaseAdmin
              .from("threecplus_call_logs")
              .select("id, started_at")
              .eq("call_id", resolvedCallId)
              .eq("user_id", userData.id)
              .is("ended_at", null)
              .maybeSingle();
            logToUpdate = data;
          }
          
          if (!logToUpdate) {
            // Fallback: most recent call for this user that hasn't ended yet
            const { data } = await supabaseAdmin
              .from("threecplus_call_logs")
              .select("id, started_at")
              .eq("user_id", userData.id)
              .is("ended_at", null)
              .order("started_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            logToUpdate = data;
          }

          if (logToUpdate) {
            const startedAt = logToUpdate.started_at ? new Date(logToUpdate.started_at).getTime() : null;
            const endedAtMs = new Date(endedAt).getTime();
            const durationSeconds = startedAt ? Math.round((endedAtMs - startedAt) / 1000) : 0;

            const { error: updateError } = await supabaseAdmin
              .from("threecplus_call_logs")
              .update({
                ended_at: endedAt,
                duration_seconds: durationSeconds,
                status: "finished",
              })
              .eq("id", logToUpdate.id);

            if (updateError) {
              console.error("[threecplus-agent] hangup: failed to update call log:", JSON.stringify(updateError));
            } else {
              console.log("[threecplus-agent] hangup: updated call", logToUpdate.id, "duration", durationSeconds, "s");
            }
          } else {
            console.log("[threecplus-agent] hangup: no open call log found to update");
          }
          
          // Also mark any other stale open calls for this user as missed/finished
          await supabaseAdmin
            .from("threecplus_call_logs")
            .update({ ended_at: endedAt, status: "finished" })
            .eq("user_id", userData.id)
            .is("ended_at", null)
            .neq("id", logToUpdate?.id ?? "00000000-0000-0000-0000-000000000000");
            
        } catch (err) {
          console.error("[threecplus-agent] hangup: error updating call duration:", err);
        }
      }

      return new Response(
        JSON.stringify({
          success,
          method: success && !(res.ok || res.status === 204) ? "already_hung_up" : "hangup",
          call_id: resolvedCallId,
          runtime,
          error: success ? null : extractApiMessage(text, "A 3C Plus não confirmou o encerramento da chamada."),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Qualify call
    if (action === "qualify") {
      const { call_id, qualification_id } = body;
      if (!call_id || !qualification_id) {
        return new Response(JSON.stringify({ success: false, error: "call_id e qualification_id são obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const res = await fetch(`${apiBase}/agent/call/${call_id}/qualify?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ qualification: qualification_id }),
      });
      console.log("[threecplus-agent] qualify:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Enter work break
    if (action === "pause_enter") {
      const { work_break_id } = body;
      if (!work_break_id) {
        return new Response(JSON.stringify({ success: false, error: "work_break_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const res = await fetch(`${apiBase}/agent/work_break/${work_break_id}/enter?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] pause_enter:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Exit work break
    if (action === "pause_exit") {
      const res = await fetch(`${apiBase}/agent/work_break_exit?api_token=${effectiveApiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] pause_exit:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get logged campaign info
    if (action === "get_logged_campaign") {
      const res = await fetch(`${apiBase}/campaigns/agent/loggedCampaign?api_token=${effectiveApiToken}`, {
        method: "GET", headers: { Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: "Agente não está logado em nenhuma campanha" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const data = text ? JSON.parse(text) : null;
        return new Response(JSON.stringify({ success: true, campaign: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Resposta inválida" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Get call history
    if (action === "get_calls") {
      const { start_date, end_date, page } = body;
      const params = new URLSearchParams({ api_token: effectiveApiToken });
      if (start_date) params.set("start_date", start_date);
      if (end_date) params.set("end_date", end_date);
      if (page) params.set("page", String(page));
      params.set("per_page", "100");
      const res = await fetch(`${apiBase}/calls?${params}`, { method: "GET", headers: { Accept: "application/json" } });
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: "Erro ao buscar histórico de chamadas" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[threecplus-agent] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
