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

      runtime.has_active_call = Boolean(callDetails?.id || callDetails?.phone);
      runtime.call_id = callDetails?.id ?? null;
      runtime.agent_status = agentStatus;
      runtime.manual_mode = Boolean(agentStatus && /manual/i.test(agentStatus));
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
    .select("metadata")
    .eq("user_id", userId)
    .eq("provider", "3cplus")
    .maybeSingle();

  const metadata = asRecord(userInt?.metadata);
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
      .upsert({ user_id: userId, provider: "3cplus", access_token: "account_level", metadata: nextMetadata }, { onConflict: "user_id,provider" });
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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, account_id")
      .eq("auth_user_id", user.id)
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
        .select("metadata")
        .eq("user_id", userData.id)
        .eq("provider", "3cplus")
        .maybeSingle();

      const prevMeta = asRecord(existing?.metadata) ?? {};
      const nextMetadata = { ...prevMeta, extension: String(ext).trim(), ...(extPwd ? { extension_password: String(extPwd).trim() } : {}) };

      await supabaseAdmin
        .from("user_integrations")
        .upsert(
          { user_id: userData.id, provider: "3cplus", access_token: "account_level", metadata: nextMetadata },
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

    // Return connection info
    if (action === "get_connection_info") {
      return new Response(
        JSON.stringify({
          success: true,
          domain: baseDomain,
          api_token: apiToken,
          extension_url: `${baseDomain}/extension?api_token=${apiToken}`,
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
      const res = await fetch(`${apiBase}/agent/login?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ campaign: campaign_id }),
      });
      const text = await res.text();
      console.log("[threecplus-agent] login:", res.status, text);
      if (res.ok || res.status === 204) {
        return new Response(JSON.stringify({ success: true, message: "Login na campanha realizado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: false, error: "Falha ao entrar na campanha", status: res.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Logout
    if (action === "logout") {
      const manualExitRes = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const manualExitText = await manualExitRes.text();
      console.log("[threecplus-agent] logout manual_call_exit:", manualExitRes.status, manualExitText);

      const res = await fetch(`${apiBase}/agent/logout?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] logout:", res.status, text);

      let runtime = null;
      let success = res.ok || res.status === 204;

      if (!success) {
        runtime = await fetchAgentRuntimeState(apiBase, apiToken);
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
      const res = await fetch(`${apiBase}/agent/manual_call/enter?api_token=${apiToken}`, {
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
      const res = await fetch(`${apiBase}/agent/manual_call/dial?api_token=${apiToken}`, {
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
      const { phone } = body;
      if (!phone) {
        return new Response(JSON.stringify({ success: false, error: "phone é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanPhone = phone.replace(/\D/g, "");

      const { extension, password } = await resolveClick2CallExtension(supabaseAdmin, userData.id, baseDomain, apiToken);

      const click2callPayload: Record<string, string> = { phone: cleanPhone };
      if (extension) click2callPayload.extension = extension;
      if (password) click2callPayload.password = password;

      const click2callRes = await fetch(`${apiBase}/click2call?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(click2callPayload),
      });
      const click2callText = await click2callRes.text();
      const click2callPayloadResponse = safeJsonParse(click2callText);
      const click2callCall = extractCallDetails(click2callPayloadResponse);
      console.log("[threecplus-agent] place_call click2call:", click2callRes.status, click2callText);

      if (click2callRes.ok || click2callRes.status === 204) {
        await logCallToDb(supabaseAdmin, userData.account_id, userData.id, click2callCall || { phone: cleanPhone }, "click2call");
        return new Response(JSON.stringify({ success: true, mode: "click2call", call: click2callCall }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fallback: manual mode
      const enterRes = await fetch(`${apiBase}/agent/manual_call/enter?api_token=${apiToken}`, {
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

        const dialRes = await fetch(`${apiBase}/agent/manual_call/dial?api_token=${apiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ phone: cleanPhone }),
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

      const click2callNeedsExtension = click2callRes.status === 422 && /extension/i.test(extractApiMessage(click2callText, click2callText));
      return new Response(
        JSON.stringify({
          success: false,
          error: click2callNeedsExtension
            ? "A 3C Plus exigiu o ramal do agente para a ligação direta, mas ele não foi identificado automaticamente."
            : agentNotIdle
              ? "O agente não está ocioso no 3C Plus. Deixe o ramal livre ou coloque o agente em modo manual antes de discar."
              : extractApiMessage(enterText, extractApiMessage(click2callText, "Não foi possível iniciar a chamada.")),
          extension_resolved: Boolean(extension),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exit manual call mode
    if (action === "manual_call_exit") {
      const res = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_exit:", res.status, text);

      let runtime = null;
      let success = res.ok || res.status === 204;

      if (!success) {
        runtime = await fetchAgentRuntimeState(apiBase, apiToken);
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

      let runtime = await fetchAgentRuntimeState(apiBase, apiToken);
      let resolvedCallId = call_id ?? runtime.call_id ?? undefined;

      if (!resolvedCallId && !runtime.has_active_call) {
        return new Response(
          JSON.stringify({ success: true, method: "already_hung_up", runtime }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!resolvedCallId) {
        console.log("[threecplus-agent] hangup: trying manual_call/exit fallback");
        const exitRes = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${apiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        const exitText = await exitRes.text();
        console.log("[threecplus-agent] manual_call/exit fallback:", exitRes.status, exitText);

        runtime = await fetchAgentRuntimeState(apiBase, apiToken);
        const exitSuccess = exitRes.ok || exitRes.status === 204 || !runtime.has_active_call;
        if (exitSuccess) {
          return new Response(
            JSON.stringify({ success: true, method: "manual_exit_fallback", runtime }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("[threecplus-agent] hangup: trying logout as last resort");
        const logoutRes = await fetch(`${apiBase}/agent/logout?api_token=${apiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        const logoutText = await logoutRes.text();
        console.log("[threecplus-agent] logout fallback:", logoutRes.status, logoutText);

        runtime = await fetchAgentRuntimeState(apiBase, apiToken);
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

      const res = await fetch(`${apiBase}/agent/call/${resolvedCallId}/hangup?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] hangup:", res.status, text);

      let success = res.ok || res.status === 204;
      let manualExitSucceeded = false;

      if (!success) {
        console.log("[threecplus-agent] hangup failed, trying manual_call/exit fallback after call_id attempt");
        const exitRes = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${apiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        const exitText = await exitRes.text();
        console.log("[threecplus-agent] post-hangup manual_call_exit fallback:", exitRes.status, exitText);
        manualExitSucceeded = exitRes.ok || exitRes.status === 204;
      }

      runtime = await fetchAgentRuntimeState(apiBase, apiToken);
      if (!success && (manualExitSucceeded || !runtime.has_active_call)) {
        success = true;
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
      const res = await fetch(`${apiBase}/agent/call/${call_id}/qualify?api_token=${apiToken}`, {
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
      const res = await fetch(`${apiBase}/agent/work_break/${work_break_id}/enter?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] pause_enter:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Exit work break
    if (action === "pause_exit") {
      const res = await fetch(`${apiBase}/agent/work_break_exit?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] pause_exit:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get logged campaign info
    if (action === "get_logged_campaign") {
      const res = await fetch(`${apiBase}/campaigns/agent/loggedCampaign?api_token=${apiToken}`, {
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
      const params = new URLSearchParams({ api_token: apiToken });
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
